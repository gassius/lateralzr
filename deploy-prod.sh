#!/usr/bin/env bash

# Lateralzr Production Deployment - Wrapper Script
# This script wraps bin/deploy-prod and provides additional utility commands
# For automated deployment, use bin/deploy-prod (used by GitHub Actions)

set -e

ACTION="${1:-deploy}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Lateralzr Production Deployment"
echo "=================================="

case "$ACTION" in
    deploy)
        # Use the bin/deploy-prod script for deployment
        # It includes dirty-tree guard, git operations, build, migrate, optimize
        if [[ -x ./bin/deploy-prod ]]; then
            exec ./bin/deploy-prod
        else
            echo "❌ Error: bin/deploy-prod not found or not executable"
            exit 1
        fi
        ;;
    
    build)
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        "$SCRIPT_DIR/bin/build-prod-image" "$COMPOSE_FILE"
        ;;
    
    restart)
        echo "🔄 Restarting services..."
        docker compose -f "$COMPOSE_FILE" restart
        echo "✅ Services restarted!"
        ;;
    
    stop)
        echo "🛑 Stopping services..."
        docker compose -f "$COMPOSE_FILE" down
        echo "✅ Services stopped!"
        ;;
    
    logs)
        echo "📋 Showing logs (Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f
        ;;
    
    shell)
        echo "🐚 Opening shell in app container..."
        docker compose -f "$COMPOSE_FILE" exec app sh
        ;;
    
    migrate)
        echo "🗄️  Running migrations..."
        docker compose -f "$COMPOSE_FILE" run --rm app php artisan migrate --force
        echo "✅ Migrations complete!"
        ;;
    
    optimize)
        echo "⚡ Optimizing Laravel..."
        docker compose -f "$COMPOSE_FILE" exec app php artisan config:cache
        docker compose -f "$COMPOSE_FILE" exec app php artisan route:cache
        docker compose -f "$COMPOSE_FILE" exec app php artisan view:cache
        docker compose -f "$COMPOSE_FILE" exec queue php artisan config:cache
        docker compose -f "$COMPOSE_FILE" exec scheduler php artisan config:cache
        echo "✅ Optimization complete!"
        ;;
    
    clear)
        echo "🧹 Clearing Laravel caches..."
        docker compose -f "$COMPOSE_FILE" exec app php artisan cache:clear
        docker compose -f "$COMPOSE_FILE" exec app php artisan config:clear
        docker compose -f "$COMPOSE_FILE" exec app php artisan route:clear
        docker compose -f "$COMPOSE_FILE" exec app php artisan view:clear
        echo "✅ Caches cleared!"
        ;;
    
    status)
        echo "📊 Service status:"
        docker compose -f "$COMPOSE_FILE" ps
        ;;
    
    test)
        echo "🧪 Testing API endpoint..."
        echo ""
        curl -f https://api.lateralzr.com/api/hello && echo "" || echo "❌ API test failed!"
        ;;

    cleanup-docker)
        if [[ -x ./bin/deploy-cleanup-docker ]]; then
            exec ./bin/deploy-cleanup-docker
        else
            echo "❌ Error: bin/deploy-cleanup-docker not found or not executable"
            exit 1
        fi
        ;;

    disk-check)
        if [[ -x ./bin/deploy-disk-check.sh ]]; then
            exec ./bin/deploy-disk-check.sh
        else
            echo "❌ Error: bin/deploy-disk-check.sh not found or not executable"
            exit 1
        fi
        ;;
    
    *)
        echo "Usage: $0 [action]"
        echo ""
        echo "Actions:"
        echo "  deploy   - Full deployment (pull, build, migrate, optimize, restart) [uses bin/deploy-prod]"
        echo "  build    - Build Docker images"
        echo "  restart  - Restart all services"
        echo "  stop     - Stop all services"
        echo "  logs     - Show and follow logs"
        echo "  shell    - Open shell in app container"
        echo "  migrate  - Run database migrations"
        echo "  optimize - Cache config, routes, views"
        echo "  clear    - Clear all Laravel caches"
        echo "  status   - Show service status"
        echo "  test     - Test API health endpoint"
        echo "  cleanup-docker - Prune Docker build cache and dangling images (conservative)"
        echo "  disk-check     - Verify free disk before deploy"
        echo ""
        echo "Note: For automated deployment via GitHub Actions, see bin/deploy-prod"
        exit 1
        ;;
esac
