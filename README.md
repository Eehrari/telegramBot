# Telegram Quiz Bot
This GitHub repository contains a Telegram bot for conducting quizzes.  

This repository contains a Telegram bot for conducting quizzes with multiple-choice questions. The bot allows users to participate in quizzes, provides instant feedback on their answers, and calculates their scores. It is built using Node.js and utilizes the Telegraf framework for interacting with the Telegram Bot API.
<h2>Table of Contents</h2>

**Prerequisites**
**Installation**
**Environment Setup**
**Running the Application**
**Bot Usage**
**Quiz Management**
**Webhook Setup**


**Prerequisites**
 Before proceeding with the installation and setup, make sure you have the following requirements met:

 * Node.js (version 12 or above) and npm installed on your machine
 * Access to a MongoDB instance and its connection URI
 * A Telegram Bot Token for interacting with the Telegram API

**Installation**
  1. Clone the repository:
      * git clone https://github.com/your-username/telegram-quiz-bot.git
  2. Install the dependencies:
      * cd telegram-quiz-bot
      * npm install
  3. Set up the required environment variables:
      * Create a .env file in the project root directory.
      * Add the following environment variables to the file:
        - MONGODB_URI=your-mongodb-uri
        - TELEGRAM_BOT_TOKEN=your-telegram-bot-token
  4. Start the application:
      * npm start

**Environment Setup**
1. Create a .env file in the root directory of the project.
2. Add the following lines to the .env file:
   ```MONGODB_URI=<Your MongoDB URI>
    PORT=<Application Port>
    BOT_URI=<Your Telegram Bot Token>
    ```
Replace <Your MongoDB URI> with the connection URI of your MongoDB instance, <Application Port> with the desired port number for running the application (default is 3000), and <Your Telegram Bot Token> with the token obtained for your Telegram bot.

**Running the Application**
To run the application locally, follow the steps below:
1. Start the application using the following command:
```npm start```
2. The application will start running on the specified port (or default port 3000) and display a message in the console indicating the server is running.
   
**Usage**
  1. Start the bot by sending the /start command in your Telegram chat.
  2. Follow the instructions provided by the bot to participate in the quiz.
  3. Answer the quiz questions by selecting the options provided.
  4. Receive instant feedback on your answers and see your score at the end of the quiz.
  
For adding new quiz questions:

  1. Use the /addQuestion command (only authorized admins).
  2. Follow the instructions provided by the bot to add the quiz questions.
  3. Choose to add the next question or complete the quiz.
  4. Once the quiz is completed, it will be added to the questions.json file.

**Quiz Management**
The application provides functionality to add new questions to the quiz. Only authorized users can add questions. To add a question, follow the steps below:
1. Send the /addQuestion command to the bot.
2. Provide the quiz ID when prompted.
3. Enter the question text.
4. Enter the answer choices, separated by commas.
5. Enter the index of the correct answer (starting from 0).

The bot will confirm the successful addition of the question. After adding a question, you can choose to add the next question or complete the quiz.

**Webhook Setup**
The application supports setting up a webhook to receive updates from the Telegram API. To set up the webhook, follow the steps below:

1. Deploy your application to a hosting platform that supports webhook functionality (e.g., Heroku).
2. Obtain the complete URL for your deployed application, including the path for the Telegram webhook.
3. Set the webhook URL by replacing <complete-herokuapp-link> in the following line of code:

```bot.telegram.setWebhook(`Your complete herokuapp link/${webhookPath}`);```

with your complete Heroku app link and webhook path.

1. Make sure your deployed application is accessible over HTTPS, as Telegram requires a secure connection for webhooks.
2. Restart your application for the webhook configuration to take effect.

Once the webhook is set up, your deployed application will start receiving updates from the Telegram API, and the bot will respond accordingly.

**Conclusion**
With this documentation, you have an overview of the code and instructions on how to set up and run the Telegram bot application. 

**Contributing**
  Contributions are welcome! If you have any suggestions, improvements, or bug fixes, please open an issue or submit a pull request.

**License**
  This project is licensed under the MIT License.

**Acknowledgements**
  * Telegraf - Telegram Bot Framework for Node.js
  * Mongoose - MongoDB Object Data Modeling (ODM) library for Node.js

**Contact**
    For any inquiries or questions, please feel free to contact me at ehsan.ehrari@codetoinspire.org
  
