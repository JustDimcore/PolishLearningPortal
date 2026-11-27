using System.Text;

namespace PolishApp.Api.Features.Content;

/// <summary>Thrown at startup when the content directory has errors; the message lists all of them.</summary>
internal sealed class ContentValidationException(IReadOnlyList<ContentError> errors)
    : Exception(FormatMessage(errors))
{
    public IReadOnlyList<ContentError> Errors { get; } = errors;

    private static string FormatMessage(IReadOnlyList<ContentError> errors)
    {
        var builder = new StringBuilder($"Content has {errors.Count} error(s):");
        foreach (var error in errors)
        {
            builder.Append("\n  ").Append(error);
        }

        return builder.ToString();
    }
}
