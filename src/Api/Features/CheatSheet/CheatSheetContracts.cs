using PolishApp.Api.Features.Content;

namespace PolishApp.Api.Features.CheatSheet;

public sealed record CheatSheetResponse(string Title, IReadOnlyList<InlineSpan> Summary, IReadOnlyList<ContentSection> Sections);

/// <summary>
/// Where a word form appears on the sheet: a table cell addressed by section, block index, body row and column.
/// </summary>
/// <param name="Form">The form as written on the sheet, lower-cased.</param>
/// <param name="RowLabel">Short row header (e.g. "C" for celownik) when the table has row headers.</param>
/// <param name="ColumnLabel">The column header, e.g. the gender.</param>
public sealed record FormHit(
    string Form,
    string SectionId,
    int SectionNumber,
    string SectionTitle,
    int Block,
    int Row,
    int Column,
    string? RowLabel,
    string ColumnLabel);

/// <param name="Exact">True when the hits match the query exactly; false when they are prefix matches.</param>
public sealed record FormSearchResponse(string Query, bool Exact, IReadOnlyList<FormHit> Hits);
