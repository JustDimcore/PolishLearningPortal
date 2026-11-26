# syntax=docker/dockerfile:1

# --- 1. Client: React + Vite -> web/dist ---
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- 2. API: dotnet publish, client build goes into wwwroot ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/Api/Api.csproj src/Api/
RUN dotnet restore src/Api/Api.csproj
COPY src/ src/
COPY content/ content/
COPY --from=web /web/dist/ src/Api/wwwroot/
RUN dotnet publish src/Api/Api.csproj -c Release -o /app --no-restore -p:OpenApiGenerateDocuments=false

# --- 3. Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
COPY --from=api /app ./
USER $APP_UID
ENTRYPOINT ["dotnet", "Api.dll"]
