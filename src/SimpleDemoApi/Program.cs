var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapGet("/api/v1/time", () => DateTime.Now.ToString("HH:mm:ss"));

app.UseHealthChecks("/health/readiness", new HealthCheckOptions
{
    Predicate = _ => true,
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.UseHealthChecks("/health/liveness", new HealthCheckOptions
{
    Predicate = healthCheckRegistration => healthCheckRegistration.Name.Contains("self")
});

app.Run();