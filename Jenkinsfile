pipeline {
    agent any

    environment {
        MAJOR        = '1'
        MINOR        = '0'
        PATCH        = "${env.BUILD_NUMBER}"
        IMAGE_TAG    = "v${MAJOR}.${MINOR}.${PATCH}"
        DOCKER_IMAGE = 'anupkumarmridha/test-asg-server'
    }

    options {
        skipDefaultCheckout(true) // We'll only checkout if not a tag
    }

    stages {
        stage('Check If Tag Build') {
            when {
                expression {
                    // If it's a tag build (name starts with 'v'), skip everything else
                    return env.BRANCH_NAME.startsWith('v')
                }
            }
            steps {
                echo "🔄 This is a tag build (${env.BRANCH_NAME}). Skipping build to avoid loop."
            }
        }

        stage('Checkout') {
            when {
                not {
                    expression {
                        return env.BRANCH_NAME.startsWith('v')
                    }
                }
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image (dev only)') {
            when {
                allOf {
                    branch 'dev'
                    not { expression { return env.BRANCH_NAME.startsWith('v') } }
                }
            }
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${IMAGE_TAG} ."
            }
        }

        stage('Build & Push Docker Image (main only)') {
            when { branch 'main' }
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${IMAGE_TAG} ."
                withCredentials([usernamePassword(
                    credentialsId: 'docker',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
                sh "docker push ${DOCKER_IMAGE}:${IMAGE_TAG}"
                sh "docker tag ${DOCKER_IMAGE}:${IMAGE_TAG} ${DOCKER_IMAGE}:latest"
                sh "docker push ${DOCKER_IMAGE}:latest"
            }
        }

        /*
        stage('Refresh ASG Instances (main only)') {
            when { branch 'main' }
            steps {
                script {
                    // Wait a moment for Docker Hub to process the image
                    sleep(30)
                    
                    // Define your ASG name and region (update these to match your Terraform setup)
                    def asgName = 'anup-training-dev-asg' 
                    def region = 'us-east-1'
                    
                    echo "🔄 Starting ASG Instance Refresh for new Docker image..."
                    
                    try {
                        // First, verify the ASG exists
                        def asgExists = sh(
                            script: """
                                aws autoscaling describe-auto-scaling-groups \\
                                    --auto-scaling-group-names ${asgName} \\
                                    --region ${region} \\
                                    --query 'length(AutoScalingGroups)' \\
                                    --output text
                            """,
                            returnStdout: true
                        ).trim()
                        
                        if (asgExists == "0") {
                            throw new Exception("ASG '${asgName}' not found in region '${region}'")
                        }
                        
                        echo "✅ Found ASG: ${asgName}"
                        
                        // Get the LaunchTemplateName dynamically from the ASG
                        def launchTemplateName = sh(
                            script: """
                                aws autoscaling describe-auto-scaling-groups \\
                                    --auto-scaling-group-names ${asgName} \\
                                    --region ${region} \\
                                    --query 'AutoScalingGroups[0].LaunchTemplate.LaunchTemplateName' \\
                                    --output text
                            """,
                            returnStdout: true
                        ).trim()
                        echo "✅ Using Launch Template: ${launchTemplateName}"
                        // Start the instance refresh
                        sh """
                            aws autoscaling start-instance-refresh \\
                                --auto-scaling-group-name ${asgName} \\
                                --region ${region} \\
                                --preferences '{
                                    "InstanceWarmup": 300,
                                    "MinHealthyPercentage": 50,
                                    "CheckpointPercentages": [50, 100],
                                    "CheckpointDelay": 600,
                                    "SkipMatching": false
                                }' \\
                                --desired-configuration '{
                                    "LaunchTemplate": {
                                        "LaunchTemplateName": "${launchTemplateName}",
                                        "Version": "\$Latest"
                                    }
                                }'
                        """
                        
                        echo "✅ ASG Instance Refresh initiated successfully!"
                        echo "🔗 Monitor progress in AWS Console: Auto Scaling Groups → ${asgName} → Instance refresh"
                        
                    } catch (Exception e) {
                        echo "❌ Failed to refresh ASG instances: ${e.getMessage()}"
                        echo "📋 Please check:"
                        echo "   • ASG name: ${asgName}"
                        echo "   • AWS region: ${region}"
                        echo "   • Jenkins IAM permissions"
                        echo "   • Launch template exists and is latest version"
                        
                        // List available ASGs for debugging
                        try {
                            echo "🔍 Available ASGs in region ${region}:"
                            sh """
                                aws autoscaling describe-auto-scaling-groups \\
                                    --region ${region} \\
                                    --query 'AutoScalingGroups[].AutoScalingGroupName' \\
                                    --output table
                            """
                        } catch (Exception listError) {
                            echo "Could not list ASGs: ${listError.getMessage()}"
                        }
                        
                        throw e
                    }
                }
            }
        }
        */

        stage('Rolling Update ASG Instances with Ansible') {
            when { branch 'main' }
            steps {
                echo "🚀 Installing boto3 and botocore for Ansible AWS modules..."
                sh '''
                pip3 install --user boto3 botocore
                '''

                echo "🚀 Setting up environment and SSH permissions for ec2-user..."
                sh '''
                export HOME=/home/ec2-user

                # Debug: Check current user and permissions
                whoami
                id
                echo "HOME: $HOME"

                # Ensure SSH directory and key permissions are correct for ec2-user
                mkdir -p /home/ec2-user/.ssh
                sudo mv /var/lib/jenkins/.ssh/anup-training-app-key.pem /home/ec2-user/.ssh/ 2>/dev/null || true
                sudo chown ec2-user:ec2-user /home/ec2-user/.ssh/anup-training-app-key.pem
                chmod 700 /home/ec2-user/.ssh
                chmod 600 /home/ec2-user/.ssh/anup-training-app-key.pem

                # Check if key is readable
                test -r /home/ec2-user/.ssh/anup-training-app-key.pem && echo "✅ SSH key is readable" || echo "❌ SSH key not readable"
                '''

                echo "🚀 Running Ansible playbook to update Docker containers on all ASG instances..."
                sh '''
                export HOME=/home/ec2-user
                export ANSIBLE_HOST_KEY_CHECKING=False

                ansible-playbook -i localhost, asg-docker-rolling-update.yml \
                --extra-vars "asg_name=anup-training-dev-asg region=us-east-1" \
                -e ansible_ssh_private_key_file=/home/ec2-user/.ssh/anup-training-app-key.pem \
                -v
                '''
            }
        }


        // Only tag if NOT already a tag build!
        stage('Create & Push Git Tag (main only)') {
            when {
                allOf {
                    branch 'main'
                    not { expression { return env.BRANCH_NAME.startsWith('v') } }
                }
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-cred',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN')]) {
                    sh """
                      git config user.email "ci@jenkins"
                      git config user.name  "jenkins"
                      git tag -a ${IMAGE_TAG} -m "CI build ${IMAGE_TAG}"
                      git push https://${GIT_USER}:${GIT_TOKEN}@github.com/anupkumarmridha/test-asg-server-ts.git ${IMAGE_TAG}
                    """
                }
            }
        }
    }

    post {
        success { 
            script {
                if (env.BRANCH_NAME == 'main') {
                    echo "🎉 SUCCESS: Built ${IMAGE_TAG}, pushed to Docker Hub, and triggered ASG refresh!"
                } else {
                    echo "✅ Success on ${env.BRANCH_NAME} – produced ${IMAGE_TAG}"
                }
            }
        }
        failure { echo "❌ Failure on ${env.BRANCH_NAME}" }
    }
}
