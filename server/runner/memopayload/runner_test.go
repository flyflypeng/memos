package memopayload

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// TestTagFixtures runs the shared tag fixture (also used by the web remark tag plugin)
// through the production payload builder.
func TestTagFixtures(t *testing.T) {
	data, err := os.ReadFile("../../../testdata/tag-fixtures.json")
	require.NoError(t, err)
	var cases []struct {
		Name    string   `json:"name"`
		Content string   `json:"content"`
		Tags    []string `json:"tags"`
	}
	require.NoError(t, json.Unmarshal(data, &cases))
	require.NotEmpty(t, cases)
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			memo := &store.Memo{Content: c.Content}
			require.NoError(t, RebuildMemoPayload(memo))
			require.ElementsMatch(t, c.Tags, memo.Payload.Tags)
		})
	}
}

// TestHasImageFromContent checks that content referencing an image sets the has-image property,
// wherever the image sits in the Memo.
func TestHasImageFromContent(t *testing.T) {
	cases := []struct {
		name     string
		content  string
		hasImage bool
	}{
		{name: "inline image upload", content: "Screenshot:\n![](/file/resources/3/pasted-20261012-044314.png)", hasImage: true},
		{name: "external image", content: "![logo](https://example.com/logo.png)", hasImage: true},
		{name: "image in a list item", content: "- see ![](/file/resources/1/a.png)", hasImage: true},
		{name: "image in a task", content: "- [ ] fix ![](/file/resources/1/a.png)", hasImage: true},
		{name: "image in a blockquote", content: "> ![](/file/resources/1/a.png)", hasImage: true},
		{name: "image in a heading", content: "# Title ![](/file/resources/1/a.png)", hasImage: true},
		{name: "image in a table cell", content: "| a | b |\n| --- | --- |\n| ![](/file/resources/1/a.png) | x |", hasImage: true},
		{name: "plain link", content: "[file](/file/resources/1/a.png)", hasImage: false},
		{name: "image syntax in code", content: "`![](/file/resources/1/a.png)`", hasImage: false},
		{name: "image syntax in a code block", content: "```\n![](/file/resources/1/a.png)\n```", hasImage: false},
		{name: "no image", content: "just text", hasImage: false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			memo := &store.Memo{Content: c.content}
			require.NoError(t, RebuildMemoPayload(memo))
			require.Equal(t, c.hasImage, memo.Payload.Property.HasImage)
		})
	}
}
