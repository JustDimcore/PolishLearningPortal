using PolishApp.Api.Features.CheatSheet;
using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Tests;

public sealed class FormIndexTests
{
    private static FormIndex BuildIndex(string body)
    {
        var errors = new List<ContentError>();
        var parsed = MarkdownContentParser.Parse<Meta>("sheet.md", "---\ntitle: T\n---\n\n" + body, errors);
        Assert.Empty(errors);
        return FormIndex.Build(parsed!.Sections);
    }

    private const string Declension = """
        ## Declension

        | | f. | n. |
        |---|---|---|
        | **C** komu? | kobiec{ie} | okn{u} |
        | **Ms** o kim? | kobiec{ie} | okn{ie} |
        | **B** kogo? | kobiet{ę} | okn{o} |
        """;

    [Fact]
    public void Finds_every_cell_with_the_form_and_labels_it_by_row_and_column()
    {
        var result = BuildIndex(Declension).Search("kobiecie");

        Assert.True(result.Exact);
        Assert.Collection(
            result.Hits,
            h => Assert.Equal(("C", "f.", 0, 1), (h.RowLabel, h.ColumnLabel, h.Row, h.Column)),
            h => Assert.Equal(("Ms", "f.", 1, 1), (h.RowLabel, h.ColumnLabel, h.Row, h.Column)));
        Assert.All(result.Hits, h => Assert.Equal(("section-1", 0), (h.SectionId, h.Block)));
    }

    [Theory]
    [InlineData("kobiete")]
    [InlineData("KOBIETĘ")]
    [InlineData("  kobietę ")]
    public void Ignores_case_diacritics_and_spaces(string query)
    {
        var hit = Assert.Single(BuildIndex(Declension).Search(query).Hits);

        Assert.Equal("kobietę", hit.Form);
    }

    [Fact]
    public void Does_not_index_row_headers()
    {
        Assert.Empty(BuildIndex(Declension).Search("komu").Hits);
    }

    [Fact]
    public void Falls_back_to_prefix_matches_for_longer_queries()
    {
        var index = BuildIndex(Declension);

        var prefix = index.Search("okn");
        Assert.False(prefix.Exact);
        Assert.Equal(["oknie", "okno", "oknu"], prefix.Hits.Select(h => h.Form).Distinct().Order(StringComparer.Ordinal).ToArray());

        Assert.Empty(index.Search("ok").Hits);
    }

    [Fact]
    public void Indexes_all_columns_of_tables_without_row_headers_and_skips_russian_glosses()
    {
        // Cyrillic glosses are written as escapes: the code base keeps Russian text in the locale and content files.
        const string Where = "\u041a\u0443\u0434\u0430";
        var index = BuildIndex($$"""
            ## Where to

            | {{Where}}? | Gdzie? |
            |---|---|
            | Idę do sklep{u} | Jestem w sklep{ie} |
            """);

        var hit = Assert.Single(index.Search("sklepu").Hits);
        Assert.Equal((null, Where + "?", 0), (hit.RowLabel, hit.ColumnLabel, hit.Column));
        Assert.Empty(index.Search(Where).Hits);
    }

    private sealed class Meta
    {
        public string? Title { get; set; }
    }
}
