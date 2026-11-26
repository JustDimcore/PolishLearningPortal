using System.Reflection;

namespace PolishApp.Api.Features.AppInfo;

internal static class AppInfoEndpoints
{
    public static RouteGroupBuilder MapAppInfoEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/version", GetVersion)
            .WithName("GetVersion")
            .WithTags("AppInfo")
            .WithSummary("API version");

        return api;
    }

    internal static VersionResponse GetVersion()
    {
        var version = typeof(AppInfoEndpoints).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion ?? "unknown";

        return new VersionResponse("Mów po polsku!", version);
    }
}

internal sealed record VersionResponse(string Name, string Version);
