pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'anupkumarmridha/test-asg-server'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Clone Repo') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t $DOCKER_IMAGE:$IMAGE_TAG ."
            }
        }

        stage('Login to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker', 
                    usernameVariable: 'DOCKER_USER', 
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh "docker push $DOCKER_IMAGE:$IMAGE_TAG"
            }
        }
    }

    post {
        success {
            echo "✅ Successfully pushed: $DOCKER_IMAGE:$IMAGE_TAG"
        }
        failure {
            echo "❌ Build failed"
        }
    }
}
