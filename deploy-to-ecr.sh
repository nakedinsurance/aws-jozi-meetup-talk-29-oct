#!/bin/bash

# Deploy Docker containers to AWS ECR
# This script builds, tags, and pushes both containers to separate ECR repositories

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
MCP_SERVER_REPO_NAME="${MCP_SERVER_REPO_NAME:-car-sales-mcp-server}"
CAR_SALES_AGENT_REPO_NAME="${CAR_SALES_AGENT_REPO_NAME:-car-sales-agent}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_message "$RED" "❌ AWS CLI is not installed. Please install it first."
        echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    print_message "$GREEN" "✓ AWS CLI is installed"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        print_message "$RED" "❌ Docker is not running. Please start Docker."
        exit 1
    fi
    print_message "$GREEN" "✓ Docker is running"
}

# Function to get AWS account ID if not set
get_aws_account_id() {
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        print_message "$YELLOW" "Getting AWS Account ID..."
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            print_message "$RED" "❌ Failed to get AWS Account ID. Please check your AWS credentials."
            exit 1
        fi
    fi
    print_message "$GREEN" "✓ AWS Account ID: $AWS_ACCOUNT_ID"
}

# Function to create ECR repository if it doesn't exist
create_ecr_repo() {
    local repo_name=$1
    print_message "$YELLOW" "Checking if ECR repository '$repo_name' exists..."
    
    if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" &> /dev/null; then
        print_message "$GREEN" "✓ Repository '$repo_name' already exists"
    else
        print_message "$YELLOW" "Creating ECR repository '$repo_name'..."
        aws ecr create-repository \
            --repository-name "$repo_name" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        print_message "$GREEN" "✓ Repository '$repo_name' created successfully"
    fi
}

# Function to authenticate Docker with ECR
authenticate_ecr() {
    print_message "$YELLOW" "Authenticating Docker with ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    print_message "$GREEN" "✓ Docker authenticated with ECR"
}

# Function to build, tag, and push an image
deploy_image() {
    local service_name=$1
    local dockerfile_path=$2
    local repo_name=$3
    local ecr_uri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${repo_name}"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    print_message "$YELLOW" "\n========================================="
    print_message "$YELLOW" "Deploying $service_name"
    print_message "$YELLOW" "=========================================\n"
    
    # Build the image
    print_message "$YELLOW" "Building $service_name Docker image..."
    docker build \
        --platform linux/arm64 \
        -f "$dockerfile_path" \
        -t "${repo_name}:${IMAGE_TAG}" \
        .
    print_message "$GREEN" "✓ Image built successfully"
    
    # Tag for ECR
    print_message "$YELLOW" "Tagging image for ECR..."
    docker tag "${repo_name}:${IMAGE_TAG}" "${ecr_uri}:${IMAGE_TAG}"
    docker tag "${repo_name}:${IMAGE_TAG}" "${ecr_uri}:${timestamp}"
    print_message "$GREEN" "✓ Image tagged"
    
    # Push to ECR
    print_message "$YELLOW" "Pushing image to ECR..."
    docker push "${ecr_uri}:${IMAGE_TAG}"
    docker push "${ecr_uri}:${timestamp}"
    print_message "$GREEN" "✓ Image pushed successfully"
    print_message "$GREEN" "   URI: ${ecr_uri}:${IMAGE_TAG}\n"
}

# Main execution
main() {
    print_message "$GREEN" "\n========================================="
    print_message "$GREEN" "AWS ECR Deployment Script"
    print_message "$GREEN" "=========================================\n"
    
    print_message "$YELLOW" "Configuration:"
    echo "  AWS Region: $AWS_REGION"
    echo "  MCP Server Repo: $MCP_SERVER_REPO_NAME"
    echo "  Car Sales Agent Repo: $CAR_SALES_AGENT_REPO_NAME"
    echo "  Image Tag: $IMAGE_TAG"
    echo ""
    
    # Pre-flight checks
    check_aws_cli
    check_docker
    get_aws_account_id
    
    # Create ECR repositories
    create_ecr_repo "$MCP_SERVER_REPO_NAME"
    create_ecr_repo "$CAR_SALES_AGENT_REPO_NAME"
    
    # Authenticate with ECR
    authenticate_ecr
    
    # Deploy MCP Server
    deploy_image \
        "MCP Server" \
        "src/mcpServer/Dockerfile" \
        "$MCP_SERVER_REPO_NAME"
    
    # Deploy Car Sales Agent
    deploy_image \
        "Car Sales Agent" \
        "src/carSalesAgent/Dockerfile" \
        "$CAR_SALES_AGENT_REPO_NAME"
    
    print_message "$GREEN" "\n========================================="
    print_message "$GREEN" "✓ Deployment Complete!"
    print_message "$GREEN" "=========================================\n"
    
    print_message "$YELLOW" "Image URIs:"
    echo "  MCP Server: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${MCP_SERVER_REPO_NAME}:${IMAGE_TAG}"
    echo "  Car Sales Agent: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${CAR_SALES_AGENT_REPO_NAME}:${IMAGE_TAG}"
    echo ""
    
    print_message "$YELLOW" "Next Steps:"
    echo "  1. Deploy to ECS/EKS using the image URIs above"
    echo "  2. Configure environment variables (see DEPLOYMENT.md)"
    echo "  3. Set up networking and security groups"
    echo "  4. Configure load balancers if needed"
    echo ""
}

# Run main function
main

