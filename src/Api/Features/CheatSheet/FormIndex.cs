using System.Text.RegularExpressions;
using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.CheatSheet;

/// <summary>
/// Finds Polish word forms in the tables of the cheat sheet. Matching ignores case and Polish diacritics,
/// so "kobiete" finds "kobietę"; when nothing matches exactly, forms starting with the query are returned.
/// </summary>
internal sealed partial class FormIndex
{
    public const int MaxHits = 20;
    private const int MinPrefixLength = 3;

    private readonly List<(string Key, FormHit Hit)> _entries;

    private FormIndex(List<(string Key, FormHit Hit)> entries) => _entries = entries;

    public static FormIndex Build(IReadOnlyList<ContentSection> sections)
    {
        var entries = new List<(string, FormHit)>();
        foreach (var section in sections)
        {
            for (var b = 0; b < section.Blocks.Count; b++)
            {
                if (section.Blocks[b] is not TableBlock table)
                {
                    continue;
                }

                var firstColumn = table.HasRowHeaders ? 1 : 0;
                for (var r = 0; r < table.Rows.Count; r++)
                {
                    var cells = table.Rows[r].Cells;
                    var rowLabel = table.HasRowHeaders ? FirstWord(MarkdownContentParser.ToPlainText(cells[0].Content)) : null;

                    for (var c = firstColumn; c < cells.Count; c++)
                    {
                        var columnLabel = c < table.Header.Cells.Count
                            ? MarkdownContentParser.ToPlainText(table.Header.Cells[c].Content).Trim()
                            : "";
                        var text = MarkdownContentParser.ToPlainText(cells[c].Content);

                        foreach (var form in PolishWords(text).Distinct(StringComparer.Ordinal))
                        {
                            var hit = new FormHit(form, section.Id, section.Number, section.Title, b, r, c, rowLabel, columnLabel);
                            entries.Add((Normalize(form), hit));
                        }
                    }
                }
            }
        }

        return new FormIndex(entries);
    }

    public FormSearchResponse Search(string query)
    {
        var key = Normalize(query.Trim());
        if (key.Length == 0)
        {
            return new FormSearchResponse(query, Exact: true, []);
        }

        var exact = _entries.Where(e => e.Key == key).Select(e => e.Hit).Take(MaxHits).ToList();
        if (exact.Count > 0 || key.Length < MinPrefixLength)
        {
            return new FormSearchResponse(query, Exact: true, exact);
        }

        var prefix = _entries
            .Where(e => e.Key.StartsWith(key, StringComparison.Ordinal))
            .OrderBy(e => e.Key.Length)
            .Select(e => e.Hit)
            .Take(MaxHits)
            .ToList();
        return new FormSearchResponse(query, Exact: false, prefix);
    }

    /// <summary>Search key of a form: lower-cased, without Polish diacritics.</summary>
    public static string Normalize(string text) => PolishText.WithoutDiacritics(text);

    /// <summary>Words written in the Polish alphabet, two letters or longer; Russian glosses are skipped.</summary>
    private static IEnumerable<string> PolishWords(string text) =>
        PolishWordPattern().Matches(text).Select(m => m.Value.ToLowerInvariant());

    private static string FirstWord(string text) =>
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault() ?? "";

    [GeneratedRegex("[a-ząćęłńóśźż]{2,}", RegexOptions.IgnoreCase)]
    private static partial Regex PolishWordPattern();
}
