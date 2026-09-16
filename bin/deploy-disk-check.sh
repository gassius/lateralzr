#!/usr/bin/env bash

# Shared disk-space guard for production deploy scripts.
# Source from bin/deploy-prod or run directly: ./bin/deploy-disk-check.sh

check_deploy_disk_space() {
    local project_root="${1:-$(pwd)}"
    local min_gb="${DEPLOY_MIN_FREE_GB:-3}"

    if [[ "${SKIP_DISK_CHECK:-}" == "1" ]]; then
        echo "⏭️  Skipping disk check (SKIP_DISK_CHECK=1)"
        return 0
    fi

    local min_kb=$((min_gb * 1024 * 1024))

    _check_mount() {
        local path="$1"
        local label="$2"
        if [[ ! -e "$path" ]]; then
            return 0
        fi
        local avail_kb
        avail_kb=$(df -Pk "$path" | awk 'NR==2 {print $4}')
        local avail_human
        avail_human=$(df -h "$path" | awk 'NR==2 {print $4 " free on " $6}')
        echo "💾 ${label}: ${avail_human}"
        if [[ "$avail_kb" -lt "$min_kb" ]]; then
            echo "❌ Less than ${min_gb}GB free on ${label} (${path})"
            return 1
        fi
        return 0
    }

    local failed=0
    _check_mount "$project_root" "Project filesystem" || failed=1

    local docker_root="${DOCKER_ROOT:-/var/lib/docker}"
    if [[ -d "$docker_root" ]]; then
        _check_mount "$docker_root" "Docker data" || failed=1
    fi

    if [[ "$failed" -ne 0 ]]; then
        echo ""
        echo "   Free space before deploy: ./bin/deploy-cleanup-docker"
        echo "   See DEPLOYMENT.md § Disk space and maintenance"
        echo "   Emergency bypass (not recommended): SKIP_DISK_CHECK=1 ./bin/deploy-prod"
        return 1
    fi

    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    set -euo pipefail
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    cd "$PROJECT_ROOT"
    check_deploy_disk_space "$PROJECT_ROOT"
fi
