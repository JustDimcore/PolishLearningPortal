using PolishApp.Api.Features.AppInfo;
using PolishApp.Api.Features.CheatSheet;
using PolishApp.Api.Features.Exercises;
using PolishApp.Api.Features.Lessons;
using PolishApp.Api.Infrastructure;
using Scalar.AspNetCore;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.AddObservability();

    builder.Services.AddProblemDetails();
    // Numbers are numbers: the default Web options also accept strings, which leaks into the OpenAPI schema.
    builder.Services.ConfigureHttpJsonOptions(options =>
        options.SerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.Strict);
    builder.Services.AddOpenApi();
    builder.Services.AddHealthChecks();
    builder.Services.AddLessons(builder.Configuration);
    builder.Services.AddCheatSheet(builder.Configuration);
    builder.Services.AddExercises(builder.Configuration);

    var app = builder.Build();

    // Load content eagerly: an invalid lesson stops startup instead of failing the first request.
    app.Services.GetRequiredService<LessonCatalog>();
    app.Services.GetRequiredService<CheatSheetStore>();
    app.Services.GetRequiredService<ExerciseBank>();

    app.UseExceptionHandler();
    app.UseStatusCodePages();
    app.UseSerilogRequestLogging();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference();
    }

    app.MapHealthEndpoints();

    var api = app.MapGroup("/api");
    api.MapAppInfoEndpoints();
    api.MapLessonsEndpoints();
    api.MapCheatSheetEndpoints();
    api.MapExercisesEndpoints();

    // Unknown /api/* routes return a ProblemDetails 404 instead of the client's index.html.
    api.MapFallback(() => Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found"));

    // The client build (web/dist) is copied into wwwroot on publish.
    app.UseDefaultFiles();
    app.MapStaticAssets();
    app.MapFallbackToFile("index.html");

    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}
