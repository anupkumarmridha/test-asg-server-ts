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
                    credentialsId: 'docker-hub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
                sh "docker push ${DOCKER_IMAGE}:${IMAGE_TAG}"
                sh "docker tag ${DOCKER_IMAGE}:${IMAGE_TAG} ${DOCKER_IMAGE}:latest"
                sh "docker push ${DOCKER_IMAGE}:latest"
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
        success { echo "✅ Success on ${env.BRANCH_NAME} – produced ${IMAGE_TAG}" }
        failure { echo "❌ Failure on ${env.BRANCH_NAME}" }
    }
}
