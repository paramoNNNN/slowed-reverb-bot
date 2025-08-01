{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
    bun.url = "nixpkgs/b74a30dbc0a72e20df07d43109339f780b439291"; # 1.2.19
    biome.url = "nixpkgs/6b4955211758ba47fac850c040a27f23b9b4008f"; # 2.1.2
    sox.url = "nixpkgs/6027c30c8e9810896b92429f0092f624f7b1aace"; # 2021-05-09
  };

  outputs = { nixpkgs, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = pkgs.mkShell {
          nativeBuildInputs = [ pkgs.bashInteractive ];
          buildInputs = with pkgs; [
            nodejs-slim_22
            inputs.bun.legacyPackages.${system}.bun
            inputs.biome.legacyPackages.${system}.biome
            inputs.sox.legacyPackages.${system}.sox
          ];
        };
      });
}
