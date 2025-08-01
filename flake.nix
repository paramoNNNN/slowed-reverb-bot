{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
    bun.url = "nixpkgs/b74a30dbc0a72e20df07d43109339f780b439291"; # 1.2.19
    biome.url = "nixpkgs/6b4955211758ba47fac850c040a27f23b9b4008f"; # 2.1.2
  };

  outputs = { nixpkgs, flake-utils, biome, bun, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = pkgs.mkShell {
          nativeBuildInputs = [ pkgs.bashInteractive ];
          buildInputs = with pkgs; [
            nodejs-slim_22
            bun.legacyPackages.${system}.bun
            biome.legacyPackages.${system}.biome
          ];
        };
      });
}
