# Automated Deployment Setup Guide

Since you already have Jenkins building and pushing to Docker Hub, and Terraform infrastructure in place, here are the steps to automate the deployment to your ASG instances.

## 🔧 Prerequisites

1. **AWS Systems Manager (SSM) Agent** - Should be installed on your EC2 instances (comes pre-installed on Amazon Linux 2)
2. **IAM Permissions** - Your EC2 instances and Jenkins need proper IAM roles
3. **Security Groups** - Allow SSM communication

## 📋 Setup Steps

### Step 1: Update Your EC2 Instance IAM Role

Make sure your EC2 instances have these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:UpdateInstanceInformation",
                "ssm:SendCommand",
                "ssm:GetCommandInvocation"
            ],
            "Resource": "*"
        }
    ]
}
```

### Step 2: Update Jenkins IAM Role/Credentials

Jenkins needs these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "autoscaling:DescribeAutoScalingGroups",
                "ec2:DescribeInstances",
                "ssm:SendCommand",
                "ssm:GetCommandInvocation",
                "ssm:DescribeInstanceInformation"
            ],
            "Resource": "*"
        }
    ]
}
```

### Step 3: Choose Your Deployment Method

## Option A: Extended Jenkins Pipeline (Recommended)

1. **Replace your existing Jenkinsfile** with `Jenkinsfile.extended`
2. **Update the variables** in the pipeline:
   ```groovy
   AWS_REGION = 'your-region'        // e.g., 'us-east-1'
   ASG_NAME = 'your-asg-name'        // Your actual ASG name
   ```
3. **Add AWS credentials** to Jenkins:
   - Go to Jenkins → Manage Jenkins → Manage Credentials
   - Add AWS credentials with ID: `aws-credentials`

## Option B: Post-Build Script

1. **Add a post-build step** to your existing Jenkins job:
   ```bash
   # Copy jenkins-deploy-trigger.sh to your Jenkins workspace
   chmod +x scripts/jenkins-deploy-trigger.sh
   ./scripts/jenkins-deploy-trigger.sh
   ```

2. **Update the script variables**:
   ```bash
   ASG_NAME="your-actual-asg-name"
   AWS_REGION="your-actual-region"
   ```

## Option C: Standalone Deployment Script

Use the `scripts/deploy-to-asg.sh` script manually or from any CI/CD system:

```bash
# Make it executable
chmod +x scripts/deploy-to-asg.sh

# Run deployment
./scripts/deploy-to-asg.sh --asg-name "your-asg-name" --region "your-region"
```

## 🔄 How It Works

1. **Jenkins builds** and pushes new Docker image to Docker Hub
2. **Deployment script** gets triggered (automatically or manually)
3. **Script finds** all healthy instances in your ASG
4. **For each instance**, it:
   - Connects via AWS Systems Manager (SSM)
   - Runs `docker-compose pull app` to get the latest image
   - Runs `docker-compose up -d app` to restart with new image
   - Performs health check on `http://localhost:8080/health`
   - Waits before deploying to next instance (rolling deployment)

## 🛡️ Security Considerations

- **SSM Agent**: Uses AWS Systems Manager instead of SSH (more secure)
- **IAM Roles**: Uses proper AWS IAM permissions
- **Rolling Deployment**: Updates one instance at a time to maintain availability
- **Health Checks**: Verifies each deployment before moving to next instance

## 🚀 Quick Start

1. **Get your ASG name**:
   ```bash
   aws autoscaling describe-auto-scaling-groups --region your-region
   ```

2. **Test the deployment script**:
   ```bash
   # Update the script with your values
   ./scripts/deploy-to-asg.sh --asg-name "your-asg-name" --region "your-region"
   ```

3. **Integrate with Jenkins**:
   - Add the post-build step to your existing Jenkins job, OR
   - Replace your Jenkinsfile with the extended version

## 🔍 Monitoring

The deployment script provides:
- **Real-time logs** during deployment
- **Health check verification** after each instance
- **Summary report** at the end
- **Failure handling** with detailed error messages

## 📝 Configuration Files

You now have these files:
- `Jenkinsfile.extended` - Enhanced Jenkins pipeline with deployment
- `scripts/deploy-to-asg.sh` - Standalone deployment script
- `scripts/jenkins-deploy-trigger.sh` - Simple Jenkins trigger script
- `.github/workflows/deploy-to-asg.yml` - GitHub Actions alternative

Choose the approach that best fits your current Jenkins setup!
