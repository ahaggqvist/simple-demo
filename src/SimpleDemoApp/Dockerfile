FROM rg.xyz936.xyz/dotnet/aspnet:7.0-alpine AS base
WORKDIR /app
EXPOSE 80

FROM rg.xyz936.xyz/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY . .
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y \
        nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && dotnet restore SimpleDemoApp.csproj \
    && dotnet build SimpleDemoApp.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish SimpleDemoApp.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SimpleDemoApp.dll"]
