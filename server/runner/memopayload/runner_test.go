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
