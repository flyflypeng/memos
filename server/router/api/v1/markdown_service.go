package v1

import (
	"context"

	"github.com/usememos/memos/plugin/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func (*APIV1Service) GetLinkMetadata(_ context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	htmlMeta, err := httpgetter.GetHTMLMeta(request.Link)
	if err != nil {
		return nil, err
	}

	return &v1pb.LinkMetadata{
		Title:       htmlMeta.Title,
		Description: htmlMeta.Description,
		Image:       htmlMeta.Image,
	}, nil
}
