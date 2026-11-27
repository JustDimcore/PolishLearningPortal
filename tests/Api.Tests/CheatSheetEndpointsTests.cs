using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using PolishApp.Api.Features.CheatSheet;
using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Tests;

/// <summary>Runs against the real content/cheatsheet.md.</summary>
public sealed class CheatSheetEndpointsTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Sheet_has_a_declension_table_with_row_headers()
    {
        var sheet = await _client.GetFromJsonAsync<CheatSheetResponse>("/api/cheatsheet", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(sheet);
        var table = Assert.IsType<TableBlock>(sheet.Sections[0].Blocks.First(b => b is TableBlock));
        Assert.True(table.HasRowHeaders);
    }

    [Fact]
    public async Task Search_finds_a_form_in_two_cases()
    {
        var result = await _client.GetFromJsonAsync<FormSearchResponse>(
            "/api/cheatsheet/search?q=kobiecie", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(result);
        Assert.Equal(["Celownik", "Miejscownik"], result.Hits.Select(h => h.RowLabel).Order().ToArray());
    }

    [Fact]
    public async Task Search_without_a_match_returns_no_hits()
    {
        var result = await _client.GetFromJsonAsync<FormSearchResponse>(
            "/api/cheatsheet/search?q=kobietom", Json, TestContext.Current.CancellationToken);

        Assert.NotNull(result);
        Assert.Empty(result.Hits);
    }
}
