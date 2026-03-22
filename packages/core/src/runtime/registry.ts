import type { AgentPackage } from "./types.js";

export class PackageRegistry {
  private readonly packages = new Map<string, AgentPackage>();

  register(pkg: AgentPackage): void {
    this.packages.set(pkg.id, pkg);
  }

  get(packageId: string): AgentPackage {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Unknown agent package: ${packageId}`);
    }
    return pkg;
  }

  list(): AgentPackage[] {
    return [...this.packages.values()];
  }
}
