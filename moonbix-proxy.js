const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
        this.game_response = null;
        this.game = null;
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, 'proxy.txt');
        return fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
    }

    createAxiosInstance(proxy) {
        const proxyAgent = new HttpsProxyAgent(proxy);
        return axios.create({
            headers: this.headers,
            httpsAgent: proxyAgent
        });
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
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
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async callBinanceAPI(queryString, axios) {
        const accessTokenUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/third-party/access/accessToken";
        const userInfoUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/user/user-info";

        try {
            const accessTokenResponse = await axios.post(accessTokenUrl, {
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

            const userInfoResponse = await axios.post(userInfoUrl, {
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

    async startGame(accessToken, axios) {
        try {
            const response = await axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/start',
                { resourceId: 2056 },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            this.game_response = response.data;

            if (response.data.code === '000000') {
                this.log("Bắt đầu game thành công", 'success');
                return true;
            }

            if (response.data.code === '116002') {
                this.log("Không đủ lượt chơi!", 'warning');
            } else {
                this.log("Lỗi khi bắt đầu game!", 'error');
            }

            return false;
        } catch (error) {
            this.log(`Không thể bắt đầu game: ${error.message}`, 'error');
            return false;
        }
    }

    async gameData() {
        try {
            const response = await axios.post('https://vemid42929.pythonanywhere.com/api/v1/moonbix/play', this.game_response);

            if (response.data.message === 'success') {
                this.game = response.data.game;
                this.log("Nhận dữ liệu game thành công", 'success');
                return true;
            }

            this.log(response.data.message, 'warning');
            return false;
        } catch (error) {
            this.log(`Lỗi khi nhận dữ liệu game: ${error.message}`, 'error');
            return false;
        }
    }

    async completeGame(accessToken, axios) {
        try {
            const response = await axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/complete',
                {
                    resourceId: 2056,
                    payload: this.game.payload,
                    log: this.game.log
                },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            if (response.data.code === '000000' && response.data.success) {
                this.log(`Hoàn thành game thành công | Nhận được ${this.game.log} points`, 'custom');
                return true;
            }

            this.log(`Không thể hoàn thành game: ${response.data.message}`, 'error');
            return false;
        } catch (error) {
            this.log(`Lỗi khi hoàn thành game: ${error.message}`, 'error');
            return false;
        }
    }

    async getTaskList(accessToken, axios) {
        const taskListUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/list";
        try {
            const response = await axios.post(taskListUrl, {
                resourceId: 2056
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Không thể lấy danh sách nhiệm vụ: ${response.data.message}`);
            }

            const taskList = response.data.data.data[0].taskList.data;
            const resourceIds = taskList
                .filter(task => task.completedCount === 0)
                .map(task => task.resourceId);
            
            return resourceIds;
        } catch (error) {
            this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
            return null;
        }
    }

    async completeTask(accessToken, resourceId, axios) {
        const completeTaskUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/complete";
        try {
            const response = await axios.post(completeTaskUrl, {
                resourceIdList: [resourceId],
                referralCode: null
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Không thể hoàn thành nhiệm vụ: ${response.data.message}`);
            }

            if (response.data.data.type) {
                this.log(`Làm nhiệm vụ ${response.data.data.type} thành công!`, 'success');
            }

            return true;
        } catch (error) {
            this.log(`Không thể hoàn thành nhiệm vụ: ${error.message}`, 'error');
            return false;
        }
    }

    async completeTasks(accessToken, axios) {
        const resourceIds = await this.getTaskList(accessToken, axios);
        if (!resourceIds || resourceIds.length === 0) {
            this.log("No uncompleted tasks found", 'info');
            return;
        }

        for (const resourceId of resourceIds) {
            if (resourceId !== 2058) {
                const success = await this.completeTask(accessToken, resourceId, axios);
                if (success) {
                    this.log(`Đã hoàn thành nhiệm vụ: ${resourceId}`, 'success');
                } else {
                    this.log(`Không thể hoàn thành nhiệm vụ: ${resourceId}`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async playGameIfTicketsAvailable(queryString, accountIndex, firstName, proxy) {
        let proxyIP = "Unknown";
        try {
            proxyIP = await this.checkProxyIP(proxy);
        } catch (error) {
            throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
        }

        console.log(`========== Tài khoản ${accountIndex} | ${firstName.green} | ip: ${proxyIP} ==========`);
        
        const axiosInstance = this.createAxiosInstance(proxy);
        const result = await this.callBinanceAPI(queryString, axiosInstance);
        if (!result) return;

        const { userInfo, accessToken } = result;
        const totalGrade = userInfo.metaInfo.totalGrade;
        let availableTickets = userInfo.metaInfo.totalAttempts;

        this.log(`Tổng điểm: ${totalGrade}`);
        this.log(`Vé đang có: ${availableTickets}`);
        
        while (availableTickets > 0) {
            this.log(`Bắt đầu game với ${availableTickets} vé có sẵn`, 'info');
            
            if (await this.startGame(accessToken, axiosInstance)) {
                if (await this.gameData()) {
                    await this.countdown(50);
                    
                    if (await this.completeGame(accessToken, axiosInstance)) {
                        availableTickets--;
                        this.log(`Vé còn lại: ${availableTickets}`, 'info');
                    } else {
                        break;
                    }
                } else {
                    this.log("Không thể nhận dữ liệu game", 'error');
                    break;
                }
            } else {
                this.log("Không thể bắt đầu trò chơi", 'error');
                break;
            }

            if (availableTickets > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        if (availableTickets === 0) {
            this.log("Đã sử dụng hết vé", 'success');
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
                const proxy = this.proxies[i % this.proxies.length];
                
                try {
                    await this.playGameIfTicketsAvailable(queryString, i + 1, firstName, proxy);
                } catch (error) {
                    this.log(`Lỗi xử lý tài khoản ${i + 1}: ${error.message}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(100 * 60);
        }
    }
}

const client = new Binance();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});