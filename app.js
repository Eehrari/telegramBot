require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const app = express();
const port = process.env.PORT || 3000;
const isQuizStats = false;

// Function to read questions from a file
function readQuestionsFromFile() {
    const questionsData = fs.readFileSync('questions.json');
    const questions = JSON.parse(questionsData);

    // Initialize the "asked" property for each question
    questions.quizzes.forEach((quiz) => {
        quiz.questions.forEach((question) => {
            question.asked = false;
        });
    });

    return questions;
}

// Function to shuffle an array using Fisher-Yates algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

mongoose
    .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        const db = mongoose.connection;
        const userQuizCollection = db.collection('userQuiz');

        app.get('/', (req, res) => {
            res.send('Hello, Heroku!' + db);
        });

        // Store quiz-related data per chat ID
        const chatData = new Map();

        const bot = new Telegraf('Bot ID here');
        bot.use(async (ctx, next) => {
            const { chat, from, updateType, message } = ctx;
            if (updateType === 'message' && message.text === '/start') {
                const chatId = chat.id;

                // Initialize quiz data if it doesn't exist for the chat
                if (!chatData.has(chatId)) {
                    chatData.set(chatId, {
                        currentQuestionIndex: 0,
                        isButtonClickable: true,
                        userResponses: [],
                        startTime: null,
                        quizFinished: false,
                        quizInProgress: false,
                        totalScore: 0,
                        questions: readQuestionsFromFile().quizzes[readQuestionsFromFile().quizzes.length - 1].questions,
                        questionMessageId: null,
                        randomQuestions: [],
                        timerMessageId: null,
                        optionsMessageId: null,
                        currentStep: 0,
                        quizDurationInSeconds: 1200,
                        lastQuiz: readQuestionsFromFile().quizzes[readQuestionsFromFile().quizzes.length - 1],
                    });
                }
                // Check if the user has completed the quiz
                const userQuiz = await userQuizCollection.findOne({ userId: from.id, quizId: chatData.get(chatId).lastQuiz.quizId });
                if (userQuiz && userQuiz.completed) {
                    ctx.reply('You have already completed this quiz.');
                    return;
                }
            }

            // Continue to the next middleware
            next();
        });
        bot.command('responses', (ctx) => {
            const { id } = ctx.from;
            const { chat, from } = ctx;
            const chatId = chat.id;
            const quizData = chatData.get(chatId);


            const { lastQuiz, quizInProgress } = quizData;

            // const quizQuestions = lastQuiz.questions;

            if (id !== 169110356) {
                ctx.reply('Sorry, you are not authorized to perform this action.');
                return;
            }

            const questions = lastQuiz.questions;

            const doc = new PDFDocument();

            doc.fontSize(16).text('Quiz Responses', { align: 'center' }).moveDown();

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const { question: questionText, choices, correctAnswerIndex } = question;
                const correctAnswer = choices[correctAnswerIndex];
                const message = `${i + 1}. ${questionText}\nCorrect Answer: ${correctAnswer}`;

                doc.fontSize(12).text(message).moveDown();
            }

            const stream = doc.pipe(fs.createWriteStream('responses.pdf'));

            stream.on('finish', () => {
                ctx.replyWithDocument({ source: 'responses.pdf' });
            });

            doc.end();
        });

        bot.command('start', (ctx) => {
            if (isQuizStats) {
                const { chat, from } = ctx;
                const chatId = chat.id;
                const quizData = chatData.get(chatId);


                const { lastQuiz, quizInProgress } = quizData;

                const quizQuestions = lastQuiz.questions;

                if (!lastQuiz) {
                    ctx.reply('No quizzes found.');
                    return;
                }

                if (!quizQuestions || quizQuestions.length === 0) {
                    ctx.reply('No questions found for the last quiz.');
                    return;
                }

                if (quizInProgress) {
                    ctx.reply('A quiz is already in progress. Please complete it before starting again.');
                    return;
                }

                quizData.quizInProgress = true;
                quizData.totalScore = quizQuestions.length;
                quizData.currentQuestionIndex = 0;
                quizData.userResponses = [];
                quizData.startTime = new Date();
                quizData.quizFinished = false;

                sendQuestion(ctx);
            }
            else {
                ctx.reply('Quiz Expired');
            }
        });
        bot.command('addQuiz', (ctx) => {
            const { id } = ctx.from;
            if (id !== 169110356) {
                ctx.reply('Sorry, you are not authorized to perform this action.');
                return;
            }

            initiateAddQuestion(ctx);
        });
        function initiateAddQuestion(ctx) {
            ctx.reply('Please enter the quiz ID:');
            chatData.get(ctx.chat.id).currentStep = 1;
        }

        function handleAddQuestionInput(ctx) {
            const { text } = ctx.message;
            const chatId = ctx.chat.id;
            const quizData = chatData.get(chatId);
            const { currentStep } = quizData;

            switch (currentStep) {
                case 1:
                    processQuizId(ctx, quizData, text);
                    break;
                case 2:
                    processQuestion(ctx, quizData, text);
                    break;
                case 3:
                    processAnswerChoices(ctx, quizData, text);
                    break;
                case 4:
                    processCorrectAnswerIndex(ctx, quizData, text);
                    break;
            }
        }
        bot.hears(/.*/, handleAddQuestionInput);
        function processQuizId(ctx, quizData, text) {
            quizData.lastQuiz.quizId = text;
            userQuizCollection.findOne({ quizId: quizData.lastQuiz.quizId }, (err, result) => {
                if (err) {
                    ctx.reply('Failed to add the question. Please try again.');
                    return;
                }

                if (result) {
                    ctx.reply('Quiz ID already exists. Please enter another quiz ID:');
                    return;
                }

                quizData.lastQuiz = {
                    quizId: text,
                    questions: [],
                };

                ctx.reply('Please enter the question:');
                quizData.currentStep = 2;
            });
        }

        function processQuestion(ctx, quizData, text) {
            quizData.question = text;
            ctx.reply('Please enter the answer choices, separated by commas:');
            quizData.currentStep = 3;
        }

        function processAnswerChoices(ctx, quizData, text) {
            quizData.answerChoices = text.split(',').map(choice => choice.trim());
            ctx.reply('Please enter the index of the correct answer (starting from 0):');
            quizData.currentStep = 4;
        }

        function processCorrectAnswerIndex(ctx, quizData, text) {
            quizData.correctAnswerIndex = parseInt(text);

            const newQuestion = {
                question: quizData.question,
                choices: quizData.answerChoices,
                correctAnswerIndex: quizData.correctAnswerIndex,
            };

            quizData.lastQuiz.questions.push(newQuestion);

            ctx.reply('Question added successfully.');

            quizData.currentStep = 0;
            quizData.question = '';
            quizData.answerChoices = [];
            quizData.correctAnswerIndex = -1;

            const replyMarkup = Markup.inlineKeyboard([
                Markup.button.callback('Add Next Question', 'next'),
                Markup.button.callback('Complete Quiz', 'complete'),
            ]);

            ctx.reply('What would you like to do next?', replyMarkup);
        }

        bot.action('next', (ctx) => {
            ctx.reply('Please enter the next question:');
            chatData.get(ctx.chat.id).currentStep = 2;
        });

        bot.action('complete', (ctx) => {
            const quizData = chatData.get(ctx.chat.id);
            const existingQuestions = readQuestionsFromFile().quizzes;

            existingQuestions.push(quizData.lastQuiz);

            fs.writeFileSync('questions.json', JSON.stringify({ quizzes: existingQuestions }, null, 2));

            ctx.reply('Quiz added successfully.');
        });
        bot.action(/.+/, async (ctx) => {
            if (isQuizStats) {
                const { chat, update } = ctx;
                const chatId = chat.id;
                const quizData = chatData.get(chatId);
                const { lastQuiz } = quizData;
                if (!quizData.isButtonClickable) {
                    // Button click not allowed, return without processing
                    return;
                }
                const [userAnswerIndex, correctAnswerIndex] = ctx.match[0].split(':');
                const currentQuestionIndex = quizData.currentQuestionIndex;
                const currentQuestion = lastQuiz.questions[currentQuestionIndex];

                quizData.userResponses[currentQuestionIndex] = parseInt(userAnswerIndex);

                if (userAnswerIndex === correctAnswerIndex) {
                    ctx.answerCbQuery('Correct answer!', true);

                } else {
                    ctx.answerCbQuery('Incorrect answer!', true);

                }
                // ctx.deleteMessage(ctx.update.callback_query.message.message_id);            // Delete the question message
                try {
                    quizData.isButtonClickable = false;

                    setButtonClickableDelay(chatId); // Set the isButtonClickable flag to true after a delay
                    if (quizData.isButtonClickable) {
                        // Delete the question message
                        await ctx.deleteMessage(quizData.questionMessageId);
                        await ctx.deleteMessage(quizData.timerMessageId);
                        await ctx.deleteMessage(quizData.optionsMessageId);
                        quizData.timerMessageId = null;
                        quizData.questionMessageId = null;
                        quizData.optionsMessageId = null;
                    }



                } catch (error) {
                    // Handle the error here
                    console.log('Error deleting question message:', error);
                }


                quizData.currentQuestionIndex++;
                console.log("quizData.currentQuestionIndex " + quizData.currentQuestionIndex)
                if (quizData.currentQuestionIndex >= lastQuiz.questions.length) {
                    dbInsertion(ctx);
                    endQuiz(ctx);
                } else {
                    sendQuestion(ctx);
                }
            }

        });
        function setButtonClickableDelay(chatId) {
            setTimeout(() => {
                const quizData = chatData.get(chatId);
                if (quizData) {
                    quizData.isButtonClickable = true;
                }
            }, 2000); // Change the delay time (in milliseconds) as needed
        }
        function dbInsertion(ctx) {
            const { chat, from } = ctx;
            const chatId = chat.id;
            const quizData = chatData.get(chatId);
            const { lastQuiz, userResponses, totalScore, randomQuestions } = quizData;
            const { quizId, questions } = lastQuiz;
            const { first_name, last_name, username } = from;
            const userText = `User: ${first_name} ${last_name} (@${username})`;
            const { id } = from;

            userQuizCollection.findOne({ userId: id, quizId }, (err, result) => {
                if (err) {
                    return;
                }

                if (result) {
                    userQuizCollection.updateOne({ userId: id, quizId }, { $set: { completed: true } }, (err) => {
                        if (err) {
                            return;
                        }
                        //endQuiz(ctx);
                    });
                } else {
                    userQuizCollection.insertOne({ userId: id, quizId, randomQuestions, score: calculateScore(quizData), userResponses, userText, completed: true }, (err) => {
                        if (err) {
                            return;
                        }
                        console.log("userQuizCollection")

                        //endQuiz(ctx);
                    });
                }
            });
        }

        function getRandomQuestion(quizData) {
            const unansweredQuestions = quizData.lastQuiz.questions.filter((question) => !question.asked);
            if (unansweredQuestions.length === 0) {
                return null;
            }

            const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
            const question = unansweredQuestions[randomIndex];
            question.asked = true;

            const choices = [...question.choices];
            shuffleArray(choices);
            const correctAnswerIndex = choices.indexOf(question.choices[question.correctAnswerIndex]);
            question.correctAnswerIndex = correctAnswerIndex;
            question.shuffledChoices = choices; // Add shuffled choices to the question object

            return question;
        }

        function sendQuestion(ctx) {
            const { chat } = ctx;
            const chatId = chat.id;
            const quizData = chatData.get(chatId);
            const { lastQuiz, randomQuestions, questionMessageId, timerMessageId, optionsMessageId, startTime, quizFinished, currentQuestionIndex, quizDurationInSeconds } = quizData;

            const question = getRandomQuestion(quizData);
            randomQuestions.push(question);
            if (!question) {
                // All questions have been asked
                console.log("sendQuestion !quesion")
                endQuiz(ctx);
                return;
            }

            // Delete previous question and timer messages if they exist
            if (questionMessageId) {
                ctx.deleteMessage(questionMessageId);
                quizData.questionMessageId = null;
            }
            if (timerMessageId) {
                ctx.deleteMessage(timerMessageId);
                quizData.timerMessageId = null;
            }
            if (optionsMessageId) {
                ctx.deleteMessage(optionsMessageId);
                quizData.optionsMessageId = null;
            }
            if (quizFinished) {
                return;
            }

            // Check if all questions have been asked
            if (currentQuestionIndex >= lastQuiz.questions.length) {
                endQuiz(ctx);
                return;
            }

            // Create the options text with bold labels
            const optionsText = question.shuffledChoices.map((choice, index) => {
                const label = `<b>${String.fromCharCode(65 + index)}</b>`;
                return `${label}. ${choice}`;
            }).join('\n\n');
            // Create the options buttons
            const optionsButtons = question.shuffledChoices.map((choice, index) => {
                const callbackData = `${index}:${question.correctAnswerIndex}`;
                const label = String.fromCharCode(65 + index); // Convert index to letter (A, B, C, ...)
                return { text: label, callback_data: callbackData };
            });

            const keyboard = {
                inline_keyboard: optionsButtons.map(option => [option]),
            };
            const currentTime = new Date();
            const elapsedTimeInSeconds = Math.floor((currentTime - startTime) / 1000);
            const remainingTimeInSeconds = Math.max(0, quizDurationInSeconds - elapsedTimeInSeconds);
            const remainingMinutes = Math.floor(remainingTimeInSeconds / 60);
            const remainingSeconds = remainingTimeInSeconds % 60;
            const timerText = `⏰ <b>Timer:</b> ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

            ctx.replyWithHTML(timerText).then((message) => {
                quizData.timerMessageId = message.message_id; // Store the timer message ID
            });

            ctx.reply(question.question).then((message) => {
                quizData.questionMessageId = message.message_id; // Store the question message ID

                ctx.replyWithHTML(optionsText, { reply_markup: keyboard })
                    .then((optionsMessage) => {
                        quizData.optionsMessageId = optionsMessage.message_id;
                        console.log(remainingTimeInSeconds)
                        if (remainingTimeInSeconds <= 0.10) {
                            if (!quizFinished) {
                                quizData.quizFinished = true;
                                dbInsertion(ctx);
                                ctx.reply('Time\'s up! Quiz finished.');
                                endQuiz(ctx);
                            }
                        }
                    }).catch((error) => {
                        console.log('Error replying with options:', error);
                    });
            });
        }

        function endQuiz(ctx) {
            const { chat, from } = ctx;
            const chatId = chat.id;
            const quizData = chatData.get(chatId);
            const { lastQuiz, userResponses, startTime, questionMessageId, timerMessageId, optionsMessageId, quizFinished } = quizData;
            const { quizDurationInSeconds, questions } = lastQuiz;

            const endTime = new Date();
            const durationInSeconds = Math.floor((endTime - startTime) / 1000);
            const score = calculateScore(quizData);
            const resultText = `Quiz complete!\n\nDuration: ${durationInSeconds} seconds\nScore: ${score}/${questions.length}`;
            quizData.quizInProgress = false;

            questions.forEach((question) => {
                question.asked = false;
            });

            ctx.reply(resultText);

            const { first_name, last_name, username } = from;
            const userText = `User: ${first_name} ${last_name} (@${username})`;
            const messageText = `${userText}\n\n${resultText}`;
            const targetChatId = '169110356'; // Replace with the desired Telegram ID

            bot.telegram.sendMessage(targetChatId, messageText).then(() => {

                // Delete the question and timer messages
                if (questionMessageId) {

                    ctx.telegram.deleteMessage(ctx.chat.id, questionMessageId);
                    quizData.questionMessageId = null;
                }
                if (timerMessageId) {
                    ctx.telegram.deleteMessage(ctx.chat.id, timerMessageId);
                    quizData.timerMessageId = null;
                }
                if (optionsMessageId) {
                    ctx.telegram.deleteMessage(ctx.chat.id, optionsMessageId);
                    quizData.optionsMessageId = null;
                }
            });
        }

        function calculateScore(quizData) {
            const { randomQuestions, userResponses } = quizData;
            let score = 0;
            for (let i = 0; i < randomQuestions.length; i++) {
                if (userResponses[i] === randomQuestions[i].correctAnswerIndex) {
                    score++;
                }
            }
            return score;
        }

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

        // Telegram bot webhook setup
        const webhookPath = '/telegram/webhook';
        app.use(express.json());

        app.post(webhookPath, (req, res) => {
            bot.handleUpdate(req.body);
            res.sendStatus(200);
        });

        // Set the webhook URL
        bot.telegram.setWebhook(`Application URL Here/${webhookPath}`);

        // Start the Telegram bot
        bot.launch();
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB', err);
    });
