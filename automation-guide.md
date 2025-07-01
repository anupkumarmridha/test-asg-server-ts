# Complete CI/CD Automation Guide

## 🚀 Automated Deployment Flow

Your automated pipeline now works like this:

```
Code Change → GitHub → Jenkins → Docker Hub → ASG Refresh → New Instances
```

## 🔧 Setup Steps

### 1. **Configure Jenkins IAM Permissions**

Your Jenkins instance needs permission to trigger ASG refreshes. Attach this policy to your Jenkins IAM user/role:

```bash
# Create the policy
aws iam create-policy \
    --policy-name JenkinsASGRefreshPolicy \
    --policy-document file://jenkins-asg-policy.json

# Attach to your Jenkins IAM user (replace with your actual user)
aws iam attach-user-policy \
    --user-name jenkins-user \
    --policy-arn arn:aws:iam::YOUR-ACCOUNT:policy/JenkinsASGRefreshPolicy
```

### 2. **Update Jenkinsfile Configuration**

In your updated `Jenkinsfile`, change these values to match your setup:

```groovy
def stackName = 'test-asg-server-stack'  // Your CloudFormation stack name
def region = 'us-east-1'                 // Your AWS region
```

### 3. **Deploy Your Infrastructure**

Deploy the updated CloudFormation template:

```bash
aws cloudformation update-stack \
    --stack-name test-asg-server-stack \
    --template-body file://cloudformation/asg-template.yaml \
    --parameters file://parameters.json \
    --capabilities CAPABILITY_IAM
```

## 🔄 How the Automation Works

### **When you push to `main` branch:**

1. **Jenkins triggers** from GitHub webhook
2. **Builds Docker image** with new version tag
3. **Pushes to Docker Hub** (both versioned and `:latest`)
4. **Waits 30 seconds** for Docker Hub to process
5. **Triggers ASG Instance Refresh** with these settings:
   - **Instance Warmup**: 300 seconds (5 minutes)
   - **Min Healthy Percentage**: 50% (keeps half running during refresh)
   - **Checkpoints**: At 50% and 100% completion
   - **Checkpoint Delay**: 600 seconds (10 minutes between checkpoints)

### **ASG Instance Refresh Process:**

1. **Gradual Replacement**: Replaces instances in batches
2. **Health Checks**: Waits for new instances to pass health checks
3. **Zero Downtime**: Always keeps minimum healthy instances running
4. **Automatic Rollback**: Stops if health checks fail

## 📊 Monitoring the Deployment

### **Jenkins Console Output:**
```
🔄 Starting ASG Instance Refresh for new Docker image...
✅ ASG Instance Refresh initiated successfully!
🔗 Monitor progress in AWS Console: Auto Scaling Groups → test-asg-server-stack-asg → Instance refresh
```

### **Check ASG Refresh Status:**
```bash
# View current refresh status
aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name test-asg-server-stack-asg \
    --region us-east-1

# Monitor in real-time
watch -n 30 'aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name test-asg-server-stack-asg \
    --region us-east-1 --query "InstanceRefreshes[0].[Status,PercentageComplete]" \
    --output table'
```

### **AWS Console Monitoring:**
1. Go to **EC2 → Auto Scaling Groups**
2. Select your ASG: `test-asg-server-stack-asg`
3. Click **Instance refresh** tab
4. Monitor progress in real-time

## 🎯 Expected Timeline

- **Jenkins Build & Push**: 2-5 minutes
- **ASG Refresh Start**: 30 seconds
- **First Instance**: 5-7 minutes (warmup + health checks)
- **Complete Refresh**: 15-20 minutes (depends on instance count)

## 🔍 Troubleshooting

### **If ASG Refresh Fails:**
```bash
# Check refresh details
aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name test-asg-server-stack-asg \
    --region us-east-1

# Check instance health
aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names test-asg-server-stack-asg \
    --region us-east-1
```

### **If New Instances Fail Health Checks:**
1. **SSH into instance**: `ssh -i your-key.pem ec2-user@instance-ip`
2. **Check user data logs**: `sudo tail -f /var/log/user-data.log`
3. **Check application logs**: `sudo docker-compose -f /app/docker-compose.yml logs`

### **Manual Rollback:**
If something goes wrong, you can cancel the refresh:
```bash
aws autoscaling cancel-instance-refresh \
    --auto-scaling-group-name test-asg-server-stack-asg \
    --region us-east-1
```

## 🚀 Testing the Full Pipeline

1. **Make a code change** in your repository
2. **Push to main branch**: `git push origin main`
3. **Monitor Jenkins**: Watch the build progress
4. **Check Docker Hub**: Verify new image is pushed
5. **Monitor ASG**: Watch instances being refreshed
6. **Test application**: Access `http://your-load-balancer:8080/health`

## 📈 Advanced Features

### **Blue-Green Deployments (Optional):**
For even safer deployments, you can modify the refresh settings:
```groovy
"MinHealthyPercentage": 100,  // Keep all instances running
"CheckpointPercentages": [50, 100],
"CheckpointDelay": 300
```

### **Notifications (Optional):**
Add Slack/email notifications to your Jenkinsfile:
```groovy
post {
    success {
        slackSend(channel: '#deployments', 
                 message: "✅ Deployment successful: ${IMAGE_TAG}")
    }
    failure {
        slackSend(channel: '#deployments', 
                 message: "❌ Deployment failed: ${IMAGE_TAG}")
    }
}
```

## 🎉 Benefits of This Setup

- ✅ **Zero Downtime Deployments**
- ✅ **Automatic Health Checking**
- ✅ **Gradual Rollout with Checkpoints**
- ✅ **Easy Rollback if Issues Occur**
- ✅ **Consistent Infrastructure as Code**
- ✅ **Full Automation from Code to Production**

Your application will now automatically deploy new versions whenever you push to the main branch! 🚀
