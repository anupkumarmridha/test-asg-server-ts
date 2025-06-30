pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'anupkumarmridha/test-asg-server'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            when {
                branch 'dev'
            }
            steps {
                echo "🔧 Building image for dev branch (no push)"
                sh "docker build -t $DOCKER_IMAGE:$IMAGE_TAG ."
            }
        }

        stage('Build and Push Docker Image') {
            when {
                branch 'main'
            }
            steps {
                echo "🚀 Building and pushing image for main branch"
                sh "docker build -t $DOCKER_IMAGE:$IMAGE_TAG ."
                withCredentials([usernamePassword(
                    credentialsId: 'docker',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
                sh "docker push $DOCKER_IMAGE:$IMAGE_TAG"
            }
        }
    }

    post {
        success {
            echo "✅ Success on branch: ${env.BRANCH_NAME}"
        }
        failure {
            echo "❌ Failure on branch: ${env.BRANCH_NAME}"
        }
    }
}
