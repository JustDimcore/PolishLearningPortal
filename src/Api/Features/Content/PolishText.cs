using System.Text;

namespace PolishApp.Api.Features.Content;

internal static class PolishText
{
    /// <summary>Lower-cases, trims, collapses inner whitespace: "  Sklepu " → "sklepu".</summary>
    public static string Canonical(string text) =>
        string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();

    /// <summary>Lower-cases and strips Polish diacritics: "Łąka" → "laka".</summary>
    public static string WithoutDiacritics(string text)
    {
        var builder = new StringBuilder(text.Length);
        foreach (var ch in text.ToLowerInvariant())
        {
            builder.Append(ch switch
            {
                'ą' => 'a',
                'ć' => 'c',
                'ę' => 'e',
                'ł' => 'l',
                'ń' => 'n',
                'ó' => 'o',
                'ś' => 's',
                'ź' or 'ż' => 'z',
                _ => ch,
            });
        }

        return builder.ToString();
    }
}
