namespace PolishApp.Api.Features.Content;

internal static class ContentPaths
{
    /// <summary>The content directory: <c>Content:Path</c> from configuration, by default <c>content/</c> next to the app.</summary>
    public static string Root(IConfiguration configuration) =>
        configuration["Content:Path"] ?? Path.Combine(AppContext.BaseDirectory, "content");
}
