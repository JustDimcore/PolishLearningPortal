using System.ComponentModel;
using System.Text;
using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.CheatSheet;

/// <summary>The cheat sheet (content/cheatsheet.md) with its form index, loaded once at startup.</summary>
internal sealed class CheatSheetStore(CheatSheetResponse sheet, FormIndex index)
{
    public const string FileName = "cheatsheet.md";

    public CheatSheetResponse Sheet { get; } = sheet;

    public FormIndex Index { get; } = index;

    /// <exception cref="ContentValidationException">The file is missing or invalid.</exception>
    public static CheatSheetStore Load(string contentRoot)
    {
        var errors = new List<ContentError>();
        var path = Path.Combine(contentRoot, FileName);
        if (!File.Exists(path))
        {
            throw new ContentValidationException([new ContentError(FileName, 0, $"File not found under {contentRoot}")]);
        }

        var parsed = MarkdownContentParser.Parse<FrontMatter>(FileName, File.ReadAllText(path, Encoding.UTF8), errors);
        if (parsed is not null)
        {
            if (string.IsNullOrWhiteSpace(parsed.Meta.Title))
            {
                errors.Add(new ContentError(FileName, 1, "Front matter field 'title' is required"));
            }

            var summary = string.IsNullOrWhiteSpace(parsed.Meta.Summary)
                ? []
                : MarkdownContentParser.ParseInline(FileName, 1, parsed.Meta.Summary, errors);

            if (errors.Count == 0)
            {
                return new CheatSheetStore(
                    new CheatSheetResponse(parsed.Meta.Title!, summary, parsed.Sections),
                    FormIndex.Build(parsed.Sections));
            }
        }

        throw new ContentValidationException(errors);
    }

    private sealed class FrontMatter
    {
        public string? Title { get; set; }
        public string? Summary { get; set; }
    }
}

internal static class CheatSheetEndpoints
{
    public static IServiceCollection AddCheatSheet(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(_ => CheatSheetStore.Load(ContentPaths.Root(configuration)));
        return services;
    }

    public static IEndpointRouteBuilder MapCheatSheetEndpoints(this IEndpointRouteBuilder routes)
    {
        var sheet = routes.MapGroup("/cheatsheet").WithTags("CheatSheet");

        sheet.MapGet("/", (CheatSheetStore store) => TypedResults.Ok(store.Sheet))
            .WithName("GetCheatSheet")
            .WithSummary("The cheat sheet: declension, prepositions, numbers");

        sheet.MapGet("/search", (
                [Description("A word form, diacritics optional: kobiecie, kobiete")] string q,
                CheatSheetStore store) => TypedResults.Ok(store.Index.Search(q)))
            .WithName("SearchForms")
            .WithSummary("Find a word form in the cheat sheet tables");

        return routes;
    }
}
