# EC2 Auto Scaling Group Deployment Guide

This guide helps you deploy your `test-asg-server-ts` application to AWS using EC2 Auto Scaling Groups.

## Files Created

1. **`ec2-userdata.sh`** - Comprehensive user data script with monitoring and logging
2. **`ec2-userdata-optimized.sh`** - Optimized user data script for faster startup
3. **`cloudformation/asg-template.yaml`** - CloudFormation template for complete infrastructure

## Quick Deployment Options

### Option 1: Manual Launch Template (Recommended for Testing)

1. **Create Launch Template in AWS Console:**
   - Go to EC2 → Launch Templates → Create Launch Template
   - Name: `test-asg-server-launch-template`
   - AMI: Amazon Linux 2 (latest)
   - Instance Type: `t3.small` or `t3.medium`
   - Key Pair: Select your existing key pair
   - Security Group: Allow ports 22 (SSH), 8080 (HTTP), 3000 (App)
   - Advanced Details → User Data: Copy content from `ec2-userdata-optimized.sh`

2. **Create Auto Scaling Group:**
   - Go to EC2 → Auto Scaling Groups → Create Auto Scaling Group
   - Select your launch template
   - Choose VPC and subnets (at least 2 AZs)
   - Min: 1, Max: 3, Desired: 2
   - Health Check Type: EC2
   - Health Check Grace Period: 300 seconds

### Option 2: CloudFormation Deployment

```bash
# Deploy the CloudFormation stack
aws cloudformation create-stack \
  --stack-name test-asg-server-stack \
  --template-body file://cloudformation/asg-template.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=your-key-pair-name \
    ParameterKey=VpcId,ParameterValue=vpc-xxxxxxxxx \
    ParameterKey=SubnetIds,ParameterValue="subnet-xxxxxxxx,subnet-yyyyyyyy" \
  --capabilities CAPABILITY_IAM
```

### Option 3: Terraform (Alternative)

```hcl
# Create terraform/main.tf file
resource "aws_launch_template" "app" {
  name_prefix   = "test-asg-server-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t3.small"
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.app.id]
  
  user_data = base64encode(file("${path.module}/../ec2-userdata-optimized.sh"))
  
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "test-asg-server-instance"
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "test-asg-server-asg"
  vpc_zone_identifier = var.subnet_ids
  min_size            = 1
  max_size            = 3
  desired_capacity    = 2
  health_check_type   = "EC2"
  
  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
  
  tag {
    key                 = "Name"
    value               = "test-asg-server-instance"
    propagate_at_launch = true
  }
}
```

## Security Group Configuration

Your security group should allow:

```bash
# Inbound Rules
- Port 22 (SSH) from your IP: 0.0.0.0/0 (or restrict to your IP)
- Port 8080 (HTTP) from anywhere: 0.0.0.0/0
- Port 3000 (App) from anywhere: 0.0.0.0/0 (optional, for direct access)

# Outbound Rules
- All traffic: 0.0.0.0/0 (for Docker Hub access)
```

## Load Balancer Setup (Optional)

Add an Application Load Balancer for production:

```bash
# Create Target Group
aws elbv2 create-target-group \
  --name test-asg-server-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-xxxxxxxxx \
  --health-check-path /health

# Create Load Balancer
aws elbv2 create-load-balancer \
  --name test-asg-server-alb \
  --subnets subnet-xxxxxxxx subnet-yyyyyyyy \
  --security-groups sg-xxxxxxxxx
```

## Monitoring and Troubleshooting

1. **Check User Data Logs:**
   ```bash
   ssh -i your-key.pem ec2-user@instance-ip
   sudo tail -f /var/log/user-data.log
   ```

2. **Check Application Status:**
   ```bash
   sudo docker-compose -f /app/docker-compose.yml ps
   sudo docker-compose -f /app/docker-compose.yml logs
   ```

3. **Test Health Endpoint:**
   ```bash
   curl http://instance-ip:8080/health
   curl http://instance-ip:3000/health
   ```

4. **View Application Logs:**
   ```bash
   sudo docker logs asg-app
   sudo docker logs asg-mysql
   ```

## Environment Variables

The user data script sets these environment variables:
- `NODE_ENV=production`
- `USE_LOCAL_DOCKER=true`
- `DB_PROVIDER=docker`
- `DB_HOST=mysql`
- Database credentials (mysql_user/mysql_password)

## Scaling Configuration

- **Scale Up Trigger:** CPU > 70% for 2 minutes
- **Scale Down Trigger:** CPU < 30% for 5 minutes
- **Cooldown:** 300 seconds

## Cost Optimization

- Use `t3.small` or `t3.medium` instances
- Set up proper Auto Scaling policies
- Consider using Spot Instances for non-critical environments
- Enable detailed monitoring only if needed

## Deployment Checklist

- [ ] Docker image pushed to Docker Hub
- [ ] Security group configured
- [ ] Key pair available
- [ ] VPC and subnets identified
- [ ] Launch template created
- [ ] Auto Scaling Group created
- [ ] Health checks passing
- [ ] Load balancer configured (optional)
- [ ] Monitoring set up

## Next Steps

1. Test the deployment with the user data script
2. Set up CloudWatch alarms for monitoring
3. Configure log aggregation (CloudWatch Logs)
4. Set up CI/CD pipeline for automated deployments
5. Implement blue-green deployments for zero-downtime updates
