import { EditorView } from "@codemirror/view";
import { Select, Option } from "@mui/joy";
import clsx from "clsx";
import { isEqual } from "lodash-es";
import { CalendarClockIcon, LoaderIcon, SendIcon, XIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import useLocalStorage from "react-use/lib/useLocalStorage";
import MemoContent from "@/components/MemoContent";
import { memoAttachments } from "@/components/MemoContent/markdown/resourceReferences";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { memoServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore, useResourceStore, useUserStore, useWorkspaceSettingStore } from "@/store/v1";
import { MemoRelation, MemoRelation_Type } from "@/types/proto/api/v1/memo_relation_service";
import { Location, Memo, Visibility } from "@/types/proto/api/v1/memo_service";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { UserSetting } from "@/types/proto/api/v1/user_service";
import { WorkspaceMemoRelatedSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import VisibilityIcon from "../VisibilityIcon";
import AddMemoRelationPopover from "./ActionButton/AddMemoRelationPopover";
import LocationSelector from "./ActionButton/LocationSelector";
import MarkdownMenu from "./ActionButton/MarkdownMenu";
import TagSelector from "./ActionButton/TagSelector";
import UploadResourceButton from "./ActionButton/UploadResourceButton";
import ZenModeButton from "./ActionButton/ZenModeButton";
import Editor, { EditorRefActions } from "./Editor";
import { pasteUrlOverSelection } from "./Editor/commands";
import {
  classifyTransfer,
  InlineImageUpload,
  pastedImageFilename,
  planDrop,
  takeUploadAnchor,
  uploadInlineImages,
} from "./Editor/inlineImages";
import FormatBar from "./FormatBar";
import RelationListView from "./RelationListView";
import ResourceListView from "./ResourceListView";
import ZenModeEditorDialog from "./ZenModeEditorDialog";
import {
  ReconcileInput,
  ReconcileOutput,
  cancelCleanup,
  confirmUnused,
  hasUnresolvedReferences,
  reconcileResources,
} from "./reconcileResources";
import { MemoEditorContext } from "./types";

export interface Props {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  // The name of the memo to be edited.
  memoName?: string;
  // The name of the parent memo if the memo is a comment.
  parentMemoName?: string;
  autoFocus?: boolean;
  // Enable zen mode expand/collapse button (default false)
  enableZenMode?: boolean;
  // Whether the editor is currently in zen mode
  isZenMode?: boolean;
  // Callback to close zen mode
  onZenModeClose?: () => void;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  relationList: MemoRelation[];
  location: Location | undefined;
  isUploadingResource: boolean;
  isRequesting: boolean;
}

const MemoEditor = (props: Props) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, enableZenMode, isZenMode, onZenModeClose, onConfirm, onCancel } = props;
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const resourceStore = useResourceStore();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    memoVisibility: Visibility.PRIVATE,
    resourceList: [],
    relationList: [],
    location: undefined,
    isUploadingResource: false,
    isRequesting: false,
  });
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [preserveUpdateTime, setPreserveUpdateTime] = useState<boolean>(false);
  const [zenModeOpen, setZenModeOpen] = useState(false);
  const editorRef = useRef<EditorRefActions>(null);
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // The Memo as the editor opened it (empty for a new Memo) and everything uploaded since; both feed
  // the save-time resource decision.
  const originalRef = useRef<ReconcileInput["original"]>({ content: "", resources: [] });
  const sessionUploadsRef = useRef<Resource[]>([]);
  const [inlineUploadCount, setInlineUploadCount] = useState(0);
  const userSetting = userStore.userSetting as UserSetting;
  const contentCacheKey = `${currentUser.name}-${cacheKey || ""}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  const referenceRelations = memoName
    ? state.relationList.filter(
        (relation) =>
          relation.memo?.name === memoName && relation.relatedMemo?.name !== memoName && relation.type === MemoRelation_Type.REFERENCE,
      )
    : state.relationList.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const workspaceMemoRelatedSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.MEMO_RELATED)?.memoRelatedSetting ||
    WorkspaceMemoRelatedSetting.fromPartial({});

  useEffect(() => {
    editorRef.current?.setContent(contentCache || "");
  }, []);

  useEffect(() => {
    if (autoFocus) {
      focusEditor();
    }
  }, [autoFocus]);

  useEffect(() => {
    let visibility = userSetting.memoVisibility;
    if (workspaceMemoRelatedSetting.disallowPublicVisibility && visibility === "PUBLIC") {
      visibility = "PRIVATE";
    }
    setState((prevState) => ({
      ...prevState,
      memoVisibility: convertVisibilityFromString(visibility),
    }));
  }, [userSetting.memoVisibility, workspaceMemoRelatedSetting.disallowPublicVisibility]);

  useAsyncEffect(async () => {
    if (!memoName) {
      return;
    }

    const memo = await memoStore.getOrFetchMemoByName(memoName);
    if (memo) {
      focusEditor();
      originalRef.current = { content: memo.content, resources: memo.resources };
      setState((prevState) => ({
        ...prevState,
        memoVisibility: memo.visibility,
        // Resources the saved content references are inline images, not attachments.
        resourceList: memoAttachments(memo),
        relationList: memo.relations,
        location: memo.location,
      }));
      if (!contentCache) {
        editorRef.current?.setContent(memo.content ?? "");
      }
    }
  }, [memoName]);

  const handleOpenZenMode = () => {
    if (!enableZenMode) return;
    setZenModeOpen(true);
  };

  const handleZenModeOpenChange = (open: boolean) => {
    setZenModeOpen(open);
    if (!open) {
      const cachedContent = localStorage.getItem(contentCacheKey);
      editorRef.current?.setContent(cachedContent ? JSON.parse(cachedContent) : "");
      editorRef.current?.focus();
    }
  };

  // The zen editor saved the Memo, so everything this editor held for it now belongs to that Memo.
  const handleZenModeConfirm = (memoName: string) => {
    editorRef.current?.setContent("");
    localStorage.removeItem(contentCacheKey);
    sessionUploadsRef.current = [];
    setState((prevState) => ({ ...prevState, resourceList: [], relationList: [], location: undefined }));
    onConfirm?.(memoName);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Formatting, Tab and list continuation are CodeMirror keymaps; only container-level keys here.
    if (!editorRef.current || event.nativeEvent.isComposing || !(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
      return;
    }
    if (event.shiftKey) {
      if (enableZenMode) {
        event.preventDefault();
        isZenMode ? onZenModeClose?.() : handleOpenZenMode();
      }
      return;
    }
    event.preventDefault();
    void handleSaveBtnClick();
  };

  const handleMemoVisibilityChange = (visibility: Visibility) => {
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  };

  const handleSetResourceList = (resourceList: Resource[]) => {
    setState((prevState) => ({
      ...prevState,
      resourceList,
    }));
  };

  const handleSetRelationList = (relationList: MemoRelation[]) => {
    setState((prevState) => ({
      ...prevState,
      relationList,
    }));
  };

  const handleUploadResource = async (file: File) => {
    setState((state) => {
      return {
        ...state,
        isUploadingResource: true,
      };
    });

    const { name: filename, size, type } = file;
    const buffer = new Uint8Array(await file.arrayBuffer());

    try {
      const resource = await resourceStore.createResource({
        resource: Resource.fromPartial({
          filename,
          size,
          type,
          content: buffer,
        }),
      });
      setState((state) => {
        return {
          ...state,
          isUploadingResource: false,
        };
      });
      return resource;
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  const uploadMultiFiles = async (files: Iterable<File>) => {
    const uploadedResourceList: Resource[] = [];
    for (const file of files) {
      const resource = await handleUploadResource(file);
      if (resource) {
        uploadedResourceList.push(resource);
        if (memoName) {
          await resourceStore.updateResource({
            resource: Resource.fromPartial({
              name: resource.name,
              memo: memoName,
            }),
            updateMask: ["memo"],
          });
        }
      }
    }
    if (uploadedResourceList.length > 0) {
      sessionUploadsRef.current.push(...uploadedResourceList);
      setState((prevState) => ({
        ...prevState,
        resourceList: [...prevState.resourceList, ...uploadedResourceList],
      }));
    }
  };

  // Uploads images as inline images at `range` (placeholders first, references once uploaded).
  // Shared by paste, drop and the slash menu's "Upload image".
  const insertInlineImages = async (view: EditorView, uploads: InlineImageUpload[], range: { from: number; to: number }) => {
    setInlineUploadCount((count) => count + 1);
    try {
      const resources = await uploadInlineImages(
        view,
        uploads,
        range,
        async (file, filename) =>
          resourceStore.createResource({
            resource: Resource.fromPartial({
              filename,
              size: file.size,
              type: file.type,
              content: new Uint8Array(await file.arrayBuffer()),
            }),
          }),
        (error) => {
          console.error(error);
          const details = error instanceof Error && "details" in error && typeof error.details === "string" ? error.details : "";
          toast.error(details || t("editor.image-upload-failed"));
        },
      );
      sessionUploadsRef.current.push(...resources);
    } finally {
      setInlineUploadCount((count) => count - 1);
    }
  };

  // Dropped images go where they were dropped (or at the selection when dropped outside the text)
  // and keep their names; other files become attachments.
  const handleDropEvent = (event: React.DragEvent) => {
    const view = editorRef.current?.getEditor();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!view || files.length === 0) return;
    event.preventDefault();
    const plan = planDrop(view.state, files, view.posAtCoords({ x: event.clientX, y: event.clientY }));
    if (!plan) return;
    if (plan.uploads.length > 0) void insertInlineImages(view, plan.uploads, plan.range);
    if (plan.attachments.length > 0) void uploadMultiFiles(plan.attachments);
  };

  // Slash menu "Upload image": the editor has anchored the position; pick images and insert them there.
  const handleSlashUploadImage = (view: EditorView) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    const finish = () => {
      const { position, spec } = takeUploadAnchor(view.state);
      view.dispatch(spec);
      const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (position === null || files.length === 0) return;
      void insertInlineImages(
        view,
        files.map((file) => ({ file, filename: file.name })),
        { from: position, to: position },
      );
      view.focus();
    };
    input.addEventListener("change", finish, { once: true });
    input.addEventListener("cancel", finish, { once: true });
    input.click();
  };

  const handlePasteEvent = (event: ClipboardEvent, view: EditorView): boolean => {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    const action = classifyTransfer(text, Array.from(event.clipboardData?.files ?? []));
    if (action.kind === "files") {
      event.preventDefault();
      if (action.images.length > 0) {
        const now = new Date();
        const uploads = action.images.map((file) => ({ file, filename: pastedImageFilename(file, now) }));
        void insertInlineImages(view, uploads, view.state.selection.main);
      }
      if (action.attachments.length > 0) {
        void uploadMultiFiles(action.attachments);
      }
      return true;
    }
    if (pasteUrlOverSelection(text)(view)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleContentChange = (content: string) => {
    setContent(content);
    setHasContent(content !== "");
    if (content !== "") {
      setContentCache(content);
    } else {
      localStorage.removeItem(contentCacheKey);
    }
  };

  // The resources to save with the Memo (ADR 0002). The user's own resources are fetched only when
  // the content references one this session doesn't know, e.g. an image in a draft from before a
  // refresh; resources of other users are never resolved, so they are never linked.
  const reconcileForSave = async (content: string): Promise<ReconcileOutput> => {
    const input: ReconcileInput = {
      original: originalRef.current,
      current: { content, attachments: state.resourceList },
      uploadedThisSession: sessionUploadsRef.current,
      knownResources: [],
      origin: window.location.origin,
    };
    if (hasUnresolvedReferences(input)) {
      input.knownResources = await resourceStore.fetchResources();
    }
    return reconcileResources(input);
  };

  // Best effort: a resource that fails to delete stays under "Unused resources" for manual cleanup.
  // The candidates are re-checked against the server first, so one a Memo owns by now is kept; if
  // the check fails, nothing is deleted.
  const deleteUnusedResources = async (candidates: Resource[]) => {
    if (candidates.length === 0) return;
    const latest = await resourceStore.fetchResources().catch((): Resource[] => []);
    const resources = confirmUnused(candidates, latest);
    await Promise.allSettled(resources.map((resource) => resourceStore.deleteResource(resource.name)));
  };

  const handleSaveBtnClick = async () => {
    // Saving mid-upload would store the placeholder text instead of the image.
    if (state.isRequesting || inlineUploadCount > 0) {
      return;
    }

    setState((state) => {
      return {
        ...state,
        isRequesting: true,
      };
    });
    const content = editorRef.current?.getContent() ?? "";
    try {
      const { linkToMemo: resources, deleteUnused } = await reconcileForSave(content);
      // Update memo.
      if (memoName) {
        const prevMemo = await memoStore.getOrFetchMemoByName(memoName);
        if (prevMemo) {
          const updateMask = ["content", "visibility"];
          const memoPatch: Partial<Memo> = {
            name: prevMemo.name,
            content,
            visibility: state.memoVisibility,
          };
          if (
            !isEqual(
              resources.map((resource) => resource.name),
              prevMemo.resources.map((resource) => resource.name),
            )
          ) {
            updateMask.push("resources");
            memoPatch.resources = resources;
          }
          if (!isEqual(state.relationList, prevMemo.relations)) {
            updateMask.push("relations");
            memoPatch.relations = state.relationList;
          }
          if (!isEqual(state.location, prevMemo.location)) {
            updateMask.push("location");
            memoPatch.location = state.location;
          }
          const memo = await memoStore.updateMemo(memoPatch, updateMask, preserveUpdateTime);
          if (onConfirm) {
            onConfirm(memo.name);
          }
        }
      } else {
        // Create memo or memo comment.
        const request = !parentMemoName
          ? memoStore.createMemo({
              content,
              visibility: state.memoVisibility,
              resources,
              relations: state.relationList,
              location: state.location,
            })
          : memoServiceClient
              .createMemoComment({
                name: parentMemoName,
                comment: {
                  content,
                  visibility: state.memoVisibility,
                  resources,
                  relations: state.relationList,
                  location: state.location,
                },
              })
              .then((memo) => memo);
        const memo = await request;
        if (onConfirm) {
          onConfirm(memo.name);
        }
      }
      // Only after the Memo is saved: a failed save must not lose the uploads.
      void deleteUnusedResources(deleteUnused);
      editorRef.current?.setContent("");
      sessionUploadsRef.current = [];
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    localStorage.removeItem(contentCacheKey);
    setState((state) => {
      return {
        ...state,
        isRequesting: false,
        resourceList: [],
        relationList: [],
        location: undefined,
      };
    });
  };

  const handleCancelBtnClick = () => {
    localStorage.removeItem(contentCacheKey);
    // Editing an existing Memo has no draft to come back to, so its unowned uploads are dropped. A
    // new Memo's draft keeps its images; after a refresh they show under "Unused resources".
    if (memoName) {
      void deleteUnusedResources(cancelCleanup(sessionUploadsRef.current));
      sessionUploadsRef.current = [];
    }

    if (onCancel) {
      onCancel();
    }
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const handleContainerFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      focusEditor();
    }
  };

  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  const handlePreviewChange = (preview: boolean) => {
    setPreviewing(preview);
    // The editor stays mounted (hidden) while previewing, so its content and selection survive.
    if (!preview) setTimeout(() => editorRef.current?.focus());
  };

  const allowSave =
    (hasContent || state.resourceList.length > 0) && !state.isUploadingResource && inlineUploadCount === 0 && !state.isRequesting;

  return (
    <>
      {enableZenMode && (
        <ZenModeEditorDialog
          open={zenModeOpen}
          onOpenChange={handleZenModeOpenChange}
          editorProps={{
            ...props,
            enableZenMode: true,
            onConfirm: handleZenModeConfirm,
          }}
        />
      )}
      <MemoEditorContext.Provider
        value={{
          resourceList: state.resourceList,
          relationList: state.relationList,
          setResourceList: (resourceList: Resource[]) => {
            setState((prevState) => ({
              ...prevState,
              resourceList,
            }));
          },
          setRelationList: (relationList: MemoRelation[]) => {
            setState((prevState) => ({
              ...prevState,
              relationList,
            }));
          },
          memoName,
        }}
      >
        <div
          className={`${
            className ?? ""
          } overflow-hidden relative w-full flex flex-col justify-start items-start bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onDrop={handleDropEvent}
          onFocus={handleContainerFocus}
          onFocusCapture={() => setFocused(true)}
          onBlur={handleContainerBlur}
        >
          {enableZenMode && <ZenModeButton isZenMode={isZenMode} onClick={isZenMode ? onZenModeClose! : handleOpenZenMode} />}
          {(isZenMode || focused || previewing) && (
            <FormatBar
              className={clsx(enableZenMode && "pr-10")}
              getView={() => editorRef.current?.getEditor() ?? null}
              previewing={previewing}
              onPreviewChange={handlePreviewChange}
            />
          )}
          {previewing && (
            <div className={clsx("w-full px-3 py-2 overflow-y-auto", isZenMode ? "zen-mode-editor-inner" : "max-h-[50vh]")}>
              <MemoContent content={content} readonly />
            </div>
          )}
          <Editor
            ref={editorRef}
            className={clsx(isZenMode && "zen-mode-editor-inner", previewing && "!hidden")}
            contentClassName={clsx(enableZenMode && "pr-8")}
            initialContent=""
            placeholder={props.placeholder ?? t("editor.any-thoughts")}
            markdownShortcutsEnabled={!workspaceMemoRelatedSetting.disableMarkdownShortcuts}
            onContentChange={handleContentChange}
            onPaste={handlePasteEvent}
            onSlashUploadImage={handleSlashUploadImage}
          />
          <ResourceListView resourceList={state.resourceList} setResourceList={handleSetResourceList} content={content} />
          <RelationListView relationList={referenceRelations} setRelationList={handleSetRelationList} />
          <div
            className="w-full px-1 sm:px-2 py-2 flex flex-row justify-between items-center"
            onFocus={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex flex-row justify-start items-center gap-0 sm:gap-0.5 opacity-80 dark:opacity-60">
              <TagSelector editorRef={editorRef} />
              <MarkdownMenu editorRef={editorRef} />
              <UploadResourceButton />
              <AddMemoRelationPopover editorRef={editorRef} />
              {workspaceMemoRelatedSetting.enableLocation && (
                <LocationSelector
                  location={state.location}
                  onChange={(location) =>
                    setState((prevState) => ({
                      ...prevState,
                      location,
                    }))
                  }
                />
              )}
              {memoName && (
                <Tooltip title={t("editor.preserve-update-time")} placement="top">
                  <Button size="sm" variant="plain" onClick={() => setPreserveUpdateTime(!preserveUpdateTime)}>
                    <CalendarClockIcon className={clsx("w-4 h-4 mx-auto", preserveUpdateTime && "text-primary")} />
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="shrink-0 flex flex-row justify-end items-center gap-0 sm:gap-0.5">
              <Select
                className="!min-w-0"
                variant="plain"
                size="sm"
                value={state.memoVisibility}
                renderValue={() => <VisibilityIcon visibility={state.memoVisibility} />}
                onChange={(_, visibility) => {
                  if (visibility) {
                    handleMemoVisibilityChange(visibility);
                  }
                }}
              >
                {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC].map((item) => (
                  <Option key={item} value={item} className="whitespace-nowrap text-sm">
                    {t(`memo.visibility.${convertVisibilityToString(item).toLowerCase()}` as any)}
                  </Option>
                ))}
              </Select>
              {props.onCancel && (
                <Button variant="plain" size="sm" disabled={state.isRequesting} onClick={handleCancelBtnClick}>
                  <XIcon className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
                </Button>
              )}
              <Button variant="plain" size="sm" disabled={!allowSave || state.isRequesting} onClick={handleSaveBtnClick} className="group">
                {!state.isRequesting ? (
                  <SendIcon className="w-4 h-4 mx-auto text-primary" />
                ) : (
                  <LoaderIcon className="w-4 h-4 mx-auto animate-spin text-primary" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </MemoEditorContext.Provider>
    </>
  );
};

export default MemoEditor;
