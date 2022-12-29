var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapGet("/api/v1/pods", (string? resourceVersion) =>
    {
        var k8SNamespace = builder.Configuration.GetValue<string>("AppSettings:K8sNamespace");
        var kubernetesClientConfiguration =
            builder.Environment.IsDevelopment() ? KubernetesClientConfiguration.BuildConfigFromConfigFile() : KubernetesClientConfiguration.InClusterConfig();
        using var client = new Kubernetes(kubernetesClientConfiguration);

        var pods = new List<Pod>();
        var listNamespacedPod = client.CoreV1.ListNamespacedPod(k8SNamespace, resourceVersion: resourceVersion);
        foreach (var item in listNamespacedPod.Items)
        {
            var containers = item.Spec.Containers;
            pods.AddRange(containers.Select(c => c.Env.ToDictionary(envVar => envVar.Name, envVar => envVar.Value))
                .Select(enVars => new Pod
                {
                    Name = item.Metadata.Name,
                    Id = item.Metadata.Uid,
                    NodeName = item.Spec.NodeName,
                    LoggedAt = DateTime.Now.ToString("HH:mm:ss"),
                    ResourceVersion = item.Metadata.ResourceVersion,
                    EnvVars = enVars
                }));
        }

        return pods;
    }
);

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