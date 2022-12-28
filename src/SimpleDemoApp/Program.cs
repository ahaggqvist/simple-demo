var builder = WebApplication.CreateBuilder(args);
builder.Services
    .AddScoped(hc => new HttpClient());
builder.Services.AddCors(options =>
{
    options.AddPolicy("corsPolicy", corsPolicyBuilder =>
    {
        corsPolicyBuilder.WithOrigins("*").AllowAnyMethod().AllowAnyHeader();
    });
});
builder.Services.AddHealthChecks();

var timeApiUrl = builder.Configuration.GetValue<string>("AppSettings:TimeApiUrl");
var k8SNamespace = builder.Configuration.GetValue<string>("AppSettings:K8sNamespace");
var app = builder.Build();

app.MapGet("/api/v1/time",
    async (HttpClient httpClient) => await httpClient.GetStringAsync(timeApiUrl));

app.UseHealthChecks("/health/readiness", new HealthCheckOptions
{
    Predicate = _ => true,
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
app.UseHealthChecks("/health/liveness", new HealthCheckOptions
{
    Predicate = healthCheckRegistration => healthCheckRegistration.Name.Contains("self")
});

var webSocketOptions = new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
};

app.UseWebSockets(webSocketOptions);

app.Map("/api/v1/ws", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var kubernetesClientConfiguration =
            builder.Environment.IsDevelopment() ? KubernetesClientConfiguration.BuildConfigFromConfigFile() : KubernetesClientConfiguration.InClusterConfig();

        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        using var client = new Kubernetes(kubernetesClientConfiguration);
        var podWatchResponse = client.CoreV1.ListNamespacedPodWithHttpMessagesAsync(k8SNamespace, watch: true, timeoutSeconds: 7200);
        await foreach (var (eventType, item) in podWatchResponse.WatchAsync<V1Pod, V1PodList>())
        {
            var state = string.Empty;
            var containerStatuses = item.Status.ContainerStatuses;
            if (containerStatuses != null)
            {
                foreach (var containerStatus in containerStatuses)
                {
                    if (containerStatus.State.Terminated != null)
                    {
                        state = containerStatus.State.Terminated.Reason;
                    }

                    if (containerStatus.State.Waiting != null)
                    {
                        state = containerStatus.State.Waiting.Reason;
                    }

                    if (containerStatus.State.Running != null && string.IsNullOrEmpty(state))
                    {
                        state = "Running";
                    }
                }
            }

            if (string.IsNullOrEmpty(state))
            {
                state = item.Status.Phase;
            }

            var pod = new Pod
            {
                Name = item.Metadata.Name,
                Id = item.Metadata.Uid,
                NodeName = item.Spec.NodeName,
                State = state,
                EventType = eventType.ToString(),
                LoggedAt = DateTime.Now.ToString("HH:mm:ss"),
                ResourceVersion = item.Metadata.ResourceVersion
            };

            await webSocket.SendAsync(Encoding.UTF8.GetBytes(Serialize(pod)), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
});

app.UseCors("corsPolicy");

app.UseRouting();

var clientAppPath = builder.Environment.IsDevelopment()
    ? Path.Combine(builder.Environment.ContentRootPath, "clientapp/build")
    : Path.Combine(builder.Environment.ContentRootPath, $"clientapp/{builder.Environment.EnvironmentName.ToLower()}");
var clientAppStaticFileOptions = new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(clientAppPath)
};
app.UseSpaStaticFiles(clientAppStaticFileOptions);

app.MapWhen(httpContext => httpContext.Request.Path.Value != null && !httpContext.Request.Path.Value.StartsWith("/api"), applicationBuilder =>
{
    applicationBuilder.UseSpa(spaBuilder =>
    {
        if (builder.Environment.IsDevelopment())
        {
            spaBuilder.Options.SourcePath = clientAppPath;
            spaBuilder.UseReactDevelopmentServer("start");
        }
        else
        {
            spaBuilder.Options.DefaultPageStaticFileOptions = clientAppStaticFileOptions;
        }
    });
});

await app.RunAsync();