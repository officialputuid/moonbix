const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');

class Binance {
    constructor() {
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://www.binance.com",
            "Referer": "https://www.binance.com/vi/game/tg/moon-bix",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.axios = axios.create({ headers: this.headers });
        this.game_response = null;
        this.game = null;
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Waiting ${i} seconds to continue...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async callBinanceAPI(queryString) {
        const accessTokenUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/third-party/access/accessToken";
        const userInfoUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/user/user-info";

        try {
            const accessTokenResponse = await this.axios.post(accessTokenUrl, {
                queryString: queryString,
                socialType: "telegram"
            });

            if (accessTokenResponse.data.code !== "000000" || !accessTokenResponse.data.success) {
                throw new Error(`Failed to get access token: ${accessTokenResponse.data.message}`);
            }

            const accessToken = accessTokenResponse.data.data.accessToken;
            const userInfoHeaders = {
                ...this.headers,
                "X-Growth-Token": accessToken
            };

            const userInfoResponse = await this.axios.post(userInfoUrl, {
                resourceId: 2056
            }, { headers: userInfoHeaders });

            if (userInfoResponse.data.code !== "000000" || !userInfoResponse.data.success) {
                throw new Error(`Failed to get user info: ${userInfoResponse.data.message}`);
            }

            return { userInfo: userInfoResponse.data.data, accessToken };
        } catch (error) {
            this.log(`API call failed: ${error.message}`, 'error');
            return null;
        }
    }

    async startGame(accessToken) {
        try {
            const response = await this.axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/start',
                { resourceId: 2056 },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            this.game_response = response.data;

            if (response.data.code === '000000') {
                this.log("Game started successfully", 'success');
                return true;
            }

            if (response.data.code === '116002') {
                this.log("Not enough attempts!", 'warning');
            } else {
                this.log("Error starting the game!", 'error');
            }

            return false;
        } catch (error) {
            this.log(`Cannot start the game: ${error.message}`, 'error');
            return false;
        }
    }

    async gameData() {
        try {
            const response = await axios.get('https://moonbix-server-9r08ifrt4-scriptvips-projects.vercel.app/moonbix/api/v1/play', {
                params: { game_response: this.game_response },
                timeout: this.timeout * 1000
            });

            if (response.data.message === 'success') {
                this.game = response.data.game;
                this.log("Game data received successfully", 'success');
                return true;
            }

            this.log(response.data.message, 'warning');
            return false;
        } catch (error) {
            this.log(`Error receiving game data: ${error.message}`, 'error');
            return false;
        }
    }

    async completeGame(accessToken) {
        try {
            const response = await this.axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/complete',
                {
                    resourceId: 2056,
                    payload: this.game.payload,
                    log: this.game.log
                },
                {
                    headers: { 
                        ...this.headers, 
                        "X-Growth-Token": accessToken 
                    },
                    timeout: this.timeout * 1000
                }
            );

            if (response.data.success) {
                this.log(`Game completed successfully | Earned ${this.game.log} points`, 'custom');
                return true;
            }

            this.log(`Cannot complete the game: ${response.data.message}`, 'error');
            return false;
        } catch (error) {
            this.log(`Error completing the game: ${error.message}`, 'error');
            return false;
        }
    }

    async getTaskList(accessToken) {
        const taskListUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/list";
        try {
            const response = await this.axios.post(taskListUrl, {
                resourceId: 2056
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Cannot retrieve task list: ${response.data.message}`);
            }

            const taskList = response.data.data.data[0].taskList.data;
            const resourceIds = taskList
                .filter(task => task.completedCount === 0)
                .map(task => task.resourceId);
            
            return resourceIds;
        } catch (error) {
            this.log(`Cannot retrieve task list: ${error.message}`, 'error');
            return null;
        }
    }

    async completeTask(accessToken, resourceId) {
        const completeTaskUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/complete";
        try {
            const response = await this.axios.post(completeTaskUrl, {
                resourceIdList: [resourceId],
                referralCode: null
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Cannot complete the task: ${response.data.message}`);
            }

            if (response.data.data.type) {
                this.log(`Successfully completed task ${response.data.data.type}!`, 'success');
            }

            return true;
        } catch (error) {
            this.log(`Cannot complete the task: ${error.message}`, 'error');
            return false;
        }
    }

    async completeTasks(accessToken) {
        const resourceIds = await this.getTaskList(accessToken);
        if (!resourceIds || resourceIds.length === 0) {
            this.log("No uncompleted tasks found", 'info');
            return;
        }

        for (const resourceId of resourceIds) {
            if (resourceId !== 2058) {
                const success = await this.completeTask(accessToken, resourceId);
                if (success) {
                    this.log(`Completed task: ${resourceId}`, 'success');
                } else {
                    this.log(`Cannot complete task: ${resourceId}`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async playGameIfTicketsAvailable(queryString, accountIndex, firstName) {
        console.log(`========== Account ${accountIndex} | ${firstName.green} ==========`);

        const result = await this.callBinanceAPI(queryString);
        if (!result) return;

        const { userInfo, accessToken } = result;
        const totalGrade = userInfo.metaInfo.totalGrade;
        let totalAttempts = userInfo.metaInfo.totalAttempts; 
        let consumedAttempts = userInfo.metaInfo.consumedAttempts; 
        let availableTickets = totalAttempts-consumedAttempts;

        this.log(`Total points: ${totalGrade}`);
        this.log(`Available tickets: ${availableTickets}`);
        await this.completeTasks(accessToken)
        
        while (availableTickets > 0) {
            this.log(`Starting game with ${availableTickets} available tickets`, 'info');
            
            if (await this.startGame(accessToken)) {
                if (await this.gameData()) {
                    await this.countdown(50);
                    
                    if (await this.completeGame(accessToken)) {
                        availableTickets--;
                        this.log(`Remaining tickets: ${availableTickets}`, 'info');
                    } else {
                        break;
                    }
                } else {
                    this.log("Cannot retrieve game data", 'error');
                    break;
                }
            } else {
                this.log("Cannot start the game", 'error');
                break;
            }

            if (availableTickets > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        if (availableTickets === 0) {
            this.log("All tickets used up", 'success');
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const queryString = data[i];
                const userData = JSON.parse(decodeURIComponent(queryString.split('user=')[1].split('&')[0]));
                const firstName = userData.first_name;

                await this.playGameIfTicketsAvailable(queryString, i + 1, firstName);

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const randomCountdown = Math.floor(Math.random() * (1800 - 300 + 1)) + 300; // Between 5m and 30m
            await this.countdown(randomCountdown);
        }
    }
}

const client = new Binance();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});
