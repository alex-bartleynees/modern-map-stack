{
  description = "Modern map stack — PostGIS / Martin / pg_featureserv / Angular / MapLibre";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # Frontend
              nodejs_24     # Angular 22 + npm

              # Data pipeline
              gdal          # ogr2ogr — load shapefiles/GeoJSON into PostGIS
              tippecanoe    # generate PMTiles from GeoJSON

              # Database client (psql only — no server)
              postgresql

              # Utilities
              curl
              jq
            ];

            shellHook = ''
              # Point npm at the project-local cache — avoids root-owned global cache issues
              export NPM_CONFIG_CACHE="$PWD/.npm"

              echo ""
              echo "  modern-map-stack dev shell"
              echo "  node $(node --version)  npm $(npm --version)"
              echo ""
              echo "  docker compose up                              start PostGIS / Martin / pg_featureserv"
              echo "  KOORDINATES_KEY=<key> ./scripts/load-data.sh  load NZ data into PostGIS"
              echo "  cd map-fe && npm start                         Angular → http://localhost:4200"
              echo ""
            '';
          };
        }
      );
    };
}
