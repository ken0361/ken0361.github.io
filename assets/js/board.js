// Initialize Firebase
const firebaseConfig = {
    apiKey: "APIKEY_PLACEHOLDER",
    authDomain: "ken-github.firebaseapp.com",
    databaseURL: "https://ken-github-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "ken-github",
    storageBucket: "ken-github.firebasestorage.app",
    messagingSenderId: "501229830621",
    appId: "1:501229830621:web:abd5664f0138164f6d7634",
    measurementId: "G-V24YXHSMDD"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// 樂透集資應用
var lotteryApp = (function() {
    var users = {};
    var lotteryResults = {};
    var checkouts = [];
    const db_ref = 'lottery_fund';

    function init() {
        _loadData();
        _bindEvents();
    }

    function _bindEvents() {
        // 新增參與者
        $('#addUserBtn').click(function() {
            var name = $('#add-user-name').val().trim();
            var amount = parseFloat($('#add-user-amount').val());
            
            if (name && amount > 0) {
                var userId = _generateId();
                db.ref(`${db_ref}/users/${userId}`).set({
                    name: name,
                    amount: amount
                });
                $('#userForm')[0].reset();
                _loadData();
            } else {
                alert('請輸入有效的姓名和金額');
            }
        });

        // 新增刮刮樂結果
        $('#submitLotteryBtn').click(function() {
            var cost = parseFloat($('#ticket-cost').val());
            var profit = parseFloat($('#ticket-profit').val());
            
            if (!isNaN(cost) && !isNaN(profit) && cost >= 0 && profit >= 0) {
                var lotteryId = _generateId();
                db.ref(`${db_ref}/lotteries/${lotteryId}`).set({
                    cost: cost,
                    profit: profit,
                    timestamp: new Date().toLocaleString('zh-TW')
                });
                $('#lotteryForm')[0].reset();
                _loadData();
                
                // 如果收益 > 0，顯示慶祝gif；否則顯示難過gif
                if (profit > 0) {
                    _showCongratsGif();
                } else if (profit === 0) {
                    _showSadGif();
                }
            } else {
                alert('請輸入有效的成本和收益');
            }
        });

        // 結帳按鈕
        $('#checkoutBtn').click(function() {
            var totalAmount = 0;
            for (let userId in users) {
                if (users.hasOwnProperty(userId)) {
                    totalAmount += users[userId].amount;
                }
            }

            var totalCost = 0;
            var totalProfit = 0;
            for (let lotteryId in lotteryResults) {
                if (lotteryResults.hasOwnProperty(lotteryId)) {
                    totalCost += lotteryResults[lotteryId].cost;
                    totalProfit += lotteryResults[lotteryId].profit;
                }
            }

            var netProfit = totalProfit - totalCost;
            var checkoutAmount = totalAmount + netProfit;

            if (Object.keys(users).length === 0) {
                alert('請先新增參與者');
            } else {
                if (confirm('確定要結帳嗎？')) {
                    var checkoutId = _generateId();
                    db.ref(`${db_ref}/checkouts/${checkoutId}`).set({
                        amount: checkoutAmount,
                        originalAmount: totalAmount,
                        netProfit: netProfit,
                        timestamp: new Date().toLocaleString('zh-TW')
                    });
                    alert('結帳成功！金額：$' + checkoutAmount.toLocaleString());
                    _loadData();
                }
            }
        });
    }

    function _loadData() {
        // 顯示 spinner
        var userListSpinner = document.getElementById('userListSpinner');
        var lotteryListSpinner = document.getElementById('lotteryListSpinner');
        if (userListSpinner) userListSpinner.style.display = 'flex';
        if (lotteryListSpinner) lotteryListSpinner.style.display = 'flex';
        
        db.ref(`${db_ref}/users`).once('value').then((snapshot) => {
            users = snapshot.val() || {};
            _loadLotteryData();
        });
    }

    function _loadLotteryData() {
        db.ref(`${db_ref}/lotteries`).once('value').then((snapshot) => {
            lotteryResults = snapshot.val() || {};
            _loadCheckoutData();
        });
    }

    function _loadCheckoutData() {
        db.ref(`${db_ref}/checkouts`).once('value').then((snapshot) => {
            var checkoutData = snapshot.val() || {};
            checkouts = [];
            for (let checkoutId in checkoutData) {
                if (checkoutData.hasOwnProperty(checkoutId)) {
                    checkouts.push(checkoutData[checkoutId]);
                }
            }
            checkouts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            _updateDisplay();
            _calculateDistribution();
            _drawChart();
        });
    }

    function _updateDisplay() {
        // 隱藏 spinner
        document.getElementById('userListSpinner').style.display = 'none';
        document.getElementById('lotteryListSpinner').style.display = 'none';
        
        // 更新參與者列表
        var userListHtml = '';
        var totalAmount = 0;
        
        for (let userId in users) {
            if (users.hasOwnProperty(userId)) {
                var user = users[userId];
                totalAmount += user.amount;
                userListHtml += `
                    <div class="card mb-2">
                        <div class="card-body py-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold mb-1">${user.name}</h6>
                                    <p class="text-muted mb-0">投資: $${user.amount.toLocaleString()}</p>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" onclick="lotteryApp.deleteUser('${userId}')">刪除</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        document.getElementById('userList').innerHTML = userListHtml || '<p class="text-muted">尚無參與者</p>';
        
        // 更新刮刮樂清單
        var lotteryListHtml = '';
        for (let lotteryId in lotteryResults) {
            if (lotteryResults.hasOwnProperty(lotteryId)) {
                var lottery = lotteryResults[lotteryId];
                var netProfit = lottery.profit - lottery.cost;
                var profitClass = netProfit >= 0 ? 'text-success' : 'text-danger';
                lotteryListHtml += `
                    <div class="card mb-2">
                        <div class="card-body py-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold mb-1">成本: $${lottery.cost.toLocaleString()} | 中獎金額: $${lottery.profit.toLocaleString()}</h6>
                                    <p class="text-muted mb-0 ${profitClass}">損益: ${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}</p>
                                    <p class="text-muted mb-0" style="font-size: 0.85rem;">${lottery.timestamp}</p>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" onclick="lotteryApp.deleteLottery('${lotteryId}')">刪除</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        document.getElementById('lotteryList').innerHTML = lotteryListHtml || '<p class="text-muted">尚無刮刮樂結果</p>';
        
        // 更新摘要資訊
        var totalCost = 0;
        var totalProfit = 0;
        
        for (let lotteryId in lotteryResults) {
            if (lotteryResults.hasOwnProperty(lotteryId)) {
                totalCost += lotteryResults[lotteryId].cost;
                totalProfit += lotteryResults[lotteryId].profit;
            }
        }
        
        document.getElementById('totalAmount').textContent = totalAmount.toLocaleString();
        document.getElementById('totalCost').textContent = totalCost.toLocaleString();
        document.getElementById('totalProfit').textContent = totalProfit.toLocaleString();
        
        var netProfit = totalProfit - totalCost;
        document.getElementById('netProfit').textContent = (netProfit >= 0 ? '+' : '') + netProfit.toLocaleString();
    }

    function _calculateDistribution() {
        var totalAmount = 0;
        for (let userId in users) {
            if (users.hasOwnProperty(userId)) {
                totalAmount += users[userId].amount;
            }
        }

        var totalCost = 0;
        var totalProfit = 0;
        for (let lotteryId in lotteryResults) {
            if (lotteryResults.hasOwnProperty(lotteryId)) {
                totalCost += lotteryResults[lotteryId].cost;
                totalProfit += lotteryResults[lotteryId].profit;
            }
        }

        var distributionHtml = '';

        if (Object.keys(users).length === 0) {
            distributionHtml = '<p class="text-muted text-center">請先新增參與者</p>';
        } else if (totalAmount === 0) {
            distributionHtml = '<p class="text-muted text-center">總投資金額為0</p>';
        } else {
            var distribution = {};
            var netProfit = totalProfit - totalCost;
            
            for (let userId in users) {
                if (users.hasOwnProperty(userId)) {
                    var user = users[userId];
                    var ratio = user.amount / totalAmount;
                    var share = user.amount + (netProfit * ratio);
                    distribution[userId] = {
                        name: user.name,
                        amount: user.amount,
                        ratio: (ratio * 100).toFixed(2),
                        share: share.toFixed(2)
                    };
                }
            }

            // 保存分配結果到 Firebase
            db.ref(`${db_ref}/distribution`).set(distribution);

            distributionHtml = '<div class="table-responsive"><table class="table table-hover">';
            distributionHtml += '<thead><tr><th>姓名</th><th>投資金額</th><th>比例</th><th>分配金額</th></tr></thead><tbody>';
            
            for (let userId in distribution) {
                var d = distribution[userId];
                var shareClass = d.share >= 0 ? 'text-success' : 'text-danger';
                distributionHtml += `
                    <tr>
                        <td>${d.name}</td>
                        <td>$${parseFloat(d.amount).toLocaleString()}</td>
                        <td>${d.ratio}%</td>
                        <td class="${shareClass} fw-bold">$${parseFloat(d.share).toLocaleString()}</td>
                    </tr>
                `;
            }
            
            distributionHtml += '</tbody></table></div>';
        }

        document.getElementById('distributionResults').innerHTML = distributionHtml;
    }

    function _drawChart() {
        var chartCanvas = document.getElementById('checkoutChart');
        if (!chartCanvas) return;

        // 檢查深色模式
        var isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        var textColor = isDarkMode ? '#adb5bd' : '#212529';
        var gridColor = isDarkMode ? '#495057' : '#dee2e6';
        var lineColor = isDarkMode ? '#80bdff' : '#212529';
        var bgColor = isDarkMode ? 'rgba(128, 189, 255, 0.1)' : 'rgba(33, 37, 41, 0.1)';

        // 準備圖表數據
        var labels = [];
        var data = [];
        
        for (let i = 0; i < checkouts.length; i++) {
            labels.push('R' + i);
            data.push(checkouts[i].amount);
        }

        // 如果沒有數據，顯示提示
        if (data.length === 0) {
            labels = ['R0'];
            data = [0];
        }

        // 銷毀舊圖表
        if (window.checkoutChartInstance) {
            window.checkoutChartInstance.destroy();
        }

        // 創建新圖表
        var ctx = chartCanvas.getContext('2d');
        window.checkoutChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '資本額',
                    data: data,
                    borderColor: lineColor,
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointBackgroundColor: lineColor,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: textColor
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            stepSize: 1000,
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                }
            }
        });
    }

    function _generateId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function _showCongratsGif() {
        var congratsModal = new bootstrap.Modal(document.getElementById('congratsModal'));
        congratsModal.show();
    }

    function _showSadGif() {
        var sadModal = new bootstrap.Modal(document.getElementById('sadModal'));
        sadModal.show();
    }

    function deleteUser(userId) {
        if (confirm('確定要刪除此參與者嗎？')) {
            db.ref(`${db_ref}/users/${userId}`).remove();
            _loadData();
        }
    }

    function deleteLottery(lotteryId) {
        if (confirm('確定要刪除此刮刮樂結果嗎？')) {
            db.ref(`${db_ref}/lotteries/${lotteryId}`).remove();
            _loadData();
        }
    }

    return {
        init,
        deleteUser,
        deleteLottery,
        _drawChart
    };
})();

// time
function _DateTimezone(offset)
{
    d = new Date();
    utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * offset)).toLocaleDateString();
}
