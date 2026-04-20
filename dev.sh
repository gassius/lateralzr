#!/bin/bash

# Lateralzr API Development Script
# Manages Ollama and Laravel Sail services

set -e

OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3.5:9b}"
SAIL_SCRIPT="./vendor/bin/sail"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if Ollama is running
check_ollama() {
    if curl -sSf "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start Ollama
start_ollama() {
    echo -e "${YELLOW}Starting Ollama...${NC}"

    # Try to open Ollama app on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [ -d "/Applications/Ollama.app" ]; then
            open -a Ollama
            echo -e "${GREEN}Ollama app launched${NC}"
        else
            # Fallback: try to start ollama serve in background
            if command -v ollama &> /dev/null; then
                echo -e "${YELLOW}Starting ollama serve...${NC}"
                ollama serve > /dev/null 2>&1 &
                sleep 2
            else
                echo -e "${RED}Error: Ollama not found. Please install Ollama first.${NC}"
                echo "Visit https://ollama.com/download or run: brew install ollama"
                exit 1
            fi
        fi
    else
        # Linux: try to start ollama serve
        if command -v ollama &> /dev/null; then
            ollama serve > /dev/null 2>&1 &
            sleep 2
        else
            echo -e "${RED}Error: Ollama not found. Please install Ollama first.${NC}"
            exit 1
        fi
    fi

    # Wait for Ollama to be ready
    echo -e "${YELLOW}Waiting for Ollama to be ready...${NC}"
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if check_ollama; then
            echo -e "${GREEN}Ollama is running${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    echo -e "${RED}Error: Ollama failed to start after ${max_attempts} seconds${NC}"
    exit 1
}

# Function to check if model is available
check_model() {
    if curl -sSf "${OLLAMA_URL}/api/tags" | grep -q "${OLLAMA_MODEL}"; then
        return 0
    else
        return 1
    fi
}

# Function to pull model if needed
pull_model() {
    if ! check_model; then
        echo -e "${YELLOW}Model ${OLLAMA_MODEL} not found. Pulling...${NC}"
        if command -v ollama &> /dev/null; then
            ollama pull "${OLLAMA_MODEL}" || {
                echo -e "${YELLOW}Warning: Could not pull model automatically.${NC}"
                echo "Please run manually: ollama pull ${OLLAMA_MODEL}"
            }
        else
            echo -e "${YELLOW}Warning: ollama CLI not found. Please pull model manually:${NC}"
            echo "  ollama pull ${OLLAMA_MODEL}"
        fi
    fi
}

# Function to start services
up() {
    echo -e "${GREEN}Starting Lateralzr API development environment...${NC}"

    # Check if Sail script exists
    if [ ! -f "$SAIL_SCRIPT" ]; then
        echo -e "${RED}Error: Sail script not found. Run 'composer install' first.${NC}"
        exit 1
    fi

    # Check and start Ollama
    if ! check_ollama; then
        start_ollama
    else
        echo -e "${GREEN}Ollama is already running${NC}"
    fi

    # Check and pull model if needed
    pull_model

    # Start Sail
    echo -e "${YELLOW}Starting Laravel Sail...${NC}"
    $SAIL_SCRIPT up -d

    # Wait a moment for services to be ready
    sleep 3

    # Print summary
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Lateralzr API is ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "API URL:        http://localhost"
    echo "Ollama URL:     ${OLLAMA_URL}"
    echo "Model:          ${OLLAMA_MODEL}"
    echo ""
    echo "Useful commands:"
    echo "  sail artisan route:list    - List API routes"
    echo "  sail test                 - Run tests"
    echo "  sail logs                 - View logs"
    echo "  ./dev.sh down             - Stop services"
    echo ""
}

# Function to stop services
down() {
    local stop_ollama=false

    # Check for --all flag
    if [[ "$1" == "--all" ]]; then
        stop_ollama=true
    fi

    echo -e "${YELLOW}Stopping Laravel Sail...${NC}"
    $SAIL_SCRIPT stop

    if [ "$stop_ollama" = true ]; then
        echo -e "${YELLOW}Stopping Ollama...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS: try to quit the app
            osascript -e 'quit app "Ollama"' 2>/dev/null || {
                # Fallback: kill ollama processes
                pkill -f ollama || echo -e "${YELLOW}Note: Ollama may still be running${NC}"
            }
        else
            # Linux: kill ollama processes
            pkill -f ollama || echo -e "${YELLOW}Note: Ollama may still be running${NC}"
        fi
        echo -e "${GREEN}Ollama stopped${NC}"
    else
        echo -e "${GREEN}Laravel Sail stopped${NC}"
        echo -e "${YELLOW}Note: Ollama is still running (use --all to stop it)${NC}"
    fi
}

# Main command handling
case "${1:-up}" in
    up)
        up
        ;;
    down)
        down "$2"
        ;;
    *)
        echo "Usage: $0 {up|down [--all]}"
        echo ""
        echo "Commands:"
        echo "  up          Start Ollama (if needed) and Laravel Sail"
        echo "  down        Stop Laravel Sail"
        echo "  down --all  Stop Laravel Sail and Ollama"
        exit 1
        ;;
esac
