import { waitUntil } from '@vercel/functions';

export default async function handler(req, res) {
    try {
        // ==========================================
        // 1. SANITIZE THE URL PATH FOR ROUTING
        // ==========================================
        let rawUrlPath = req.url.split('?')[0].split('&')[0];
        const urlParts = rawUrlPath.split('/');
        
        const paymentIndex = urlParts.indexOf('payment');
        let path = "";

        if (paymentIndex !== -1) {
            path = urlParts.slice(paymentIndex + 1).join('/');
        }

        let body = req.body;
        if (typeof body === 'string' && body.trim() !== '') {
            try { body = JSON.parse(body); } catch (e) {}
        }

        // ==========================================
        // SYSTEM VARIABLE GENERATION (STRESS TEST SAFE)
        // ==========================================
        const currentTimestamp = Math.floor(Date.now() / 1000).toString();
        const dynamicNonce = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();

        const gatewayHeaders = {
            "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjIwMTgtMDMtMTMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiYXBpX2NsaWVudEBFaGNLQzA5QmRYUm9RMnhwWlc1MEVMcUV0WjZEN0xfSUdBIl0sImV4cCI6MTc3ODk4NTQ3MCwiaWF0IjoxNzc2MzkzNDcwLCJpc3MiOiJodHRwczovL3NiLW9hdXRoLnJldmVudWVtb25zdGVyLm15IiwianRpIjoiRWh3S0VFOUJkWFJvUVdOalpYTnpWRzlyWlc0UXdvWFJ4N09Pd2RNWSIsIm5iZiI6MTc3NjM5MzQ3MCwic3ViIjoiRWhRS0NFMWxjbU5vWVc1MEVQenhxdl80NzRYRUdCSVFDZ1JWYzJWeUVNMnhyTjc2NzRYRUdBIn0.fMOsX3mXeZ00Z7NQKKTsiA9HopEuYNWLUtvtB8OV2ED3aILJaVTv0MMl80Fa8wPmnNJaPBRFg_9sVvEMMg6fKgeYvFVOI14vTwXCFKG7mXJ_VklaTaCUUnpFR3tRN2qXisLDHLmXKX6JH27fhmT57j00YYgj_gd0Yx-FqvxyBFkKY69kvj68dfMRrtTxye6bDOzFqR0YM1uSuxixwkdAagrd-iOChjtQTlenGa7yYVuFeJnZhBqC-Mb2TwWki0I6Rppy70gvvV5fiaxe8qb8VblPyLQJEcIg_udglNdJjblbeFm1eWiUz9qJqNjC9m3PR0A6I7UYTyWuceO8S3dSUA",
            "Content-Type": "application/json",
            "X-Nonce-Str": dynamicNonce,
            "X-Signature": "sha256 LoslzYoD1765N6rLSguDe60nEJpNI3HJQWJXf7JKqVkffH0xp4LxpMPwi5SbRiPQYgnZk94D/wMS4vdqxQpn7yTvmZYqAYhGuxms5XkFJRzOsliWaU9X1GgMBR8HEA7J87cejR8ltmPPGZvMwDrbsngmkS6eA5Iu0S69MP3GAcusUEVzqOTILjiCGpmIds5G052qu5+nr0qu8dwktFbAwRXxjnPHDRSGkRwSqNKdiHYp3JGjF5U/CgbdsNDlXwfSxnUApfI1BZJENu0svkaEOie6GALNA2EpcE+hA7QuTEtGbu1aMSx+W29ISXLTksGPANGte5jG21ya97Es+Hr0Rg==",
            "X-Timestamp": currentTimestamp
        };


        // ==========================================
        // FIRST ROUTE: STEP A (Intent Creation)
        // ==========================================
        if (path === 'online') {
            const orderId = body?.order?.id || "DMYPAG" + Date.now();
            const checkoutId = orderId.replace('DMYPAG', 'DUMMY');

            return res.status(200).json({
                "item": {
                    "checkoutId": checkoutId,
                    "url": `https://dummy-wallet.vercel.app/api/payment/online/checkout?checkoutId=${checkoutId}`
                },
                "code": "SUCCESS"
            });
        }


        // ==========================================
        // SECOND ROUTE: STEP B (Checkout Page / Dispatch C & D)
        // ==========================================
        if (path === 'online/checkout') {
            let checkoutId = body?.checkoutId || req.query?.checkoutId || "";
            if (!checkoutId && req.url.includes('checkoutId=')) {
                const match = req.url.match(/checkoutId=([^&]+)/);
                if (match) checkoutId = match[1];
            }

            let currentOrderId = "";
            if (checkoutId && checkoutId.startsWith('DUMMY')) {
                currentOrderId = checkoutId.replace('DUMMY', 'DMYPAG');
            } else {
                currentOrderId = checkoutId || "DMYPAG" + Date.now();
            }

            const triggerBackgroundNotifications = async () => {
                // --- STEP C: Outbound GET Redirect ---
                const redirectUrl = `https://devlinkv2.paydee.co/mpigwv2/revenue-monster/payment-status/redirect?merchantId=SYSSPC000000001&orderId=${currentOrderId}&status=SUCCESS&transId=${currentOrderId}`;
                try {
                    await fetch(redirectUrl, { method: "GET", headers: gatewayHeaders });
                } catch (e) {}

                // --- STEP D: Outbound POST Webhook Callback ---
                const webhookUrl = "https://devlinkv2.paydee.co/webhookv2/revenue-monster/payment-status/notify/SYSSPC000000001";
                const uniqueSubId = currentOrderId.replace('DMYPAG', '');
                
                const webhookPayload = {
                    eventType: "PAYMENT_WEB_ONLINE",
                    data: {
                        balanceAmount: 100,
                        createdAt: new Date().toISOString(),
                        currencyType: "MYR",
                        method: "TNG",
                        order: { amount: 100, detail: "", id: currentOrderId, title: "Payment to merchant" },
                        payee: { userId: 1000009067743988 },
                        platform: "OPEN_API",
                        referenceId: "REF" + uniqueSubId,
                        transactionId: "TXN" + uniqueSubId + Math.floor(Math.random() * 10000),
                        region: "MALAYSIA",
                        status: "SUCCESS",
                        store: { name: "paydee merchant 1", status: "ACTIVE" },
                        terminalId: "",
                        transactionAt: new Date().toISOString(),
                        type: "WEB_PAYMENT",
                        updatedAt: new Date().toISOString(),
                        voucher: null
                    }
                };

                try {
                    await fetch(webhookUrl, { method: "POST", headers: gatewayHeaders, body: JSON.stringify(webhookPayload) });
                } catch (e) {}
            };

            // Process asynchronous callback execution out of browser context
            waitUntil(triggerBackgroundNotifications());

            // Return STEP B cashier payload immediately
            return res.status(200).json({
                "item": {
                    "type": "URL",
                    "url": "https://m-sd.tngdigital.com.my/s/cashier/index.html?bizNo=20260513111212800110171792505137973&timestamp=1778663675918&merchantId=217120000000025910811&sign=jYnBmeOOLRkUDWmhQq4%2B1V0yntKuDpcmvb%2Fx0qtM%2Fx2XCBxX6unuN%2FxRmwwakEX55IOF1dUvn0c5jEyWsaV1icsbvvesXhXNOx4uq%2FNa2wiXKuv3vrjBAPMbwIekjtwiZB77sSHpv7uRLdZgHk5yny%2BS8MKNQqrEAJuIb1gq5%2BeVd0e2OTf2kbuN%2FruFFSJQbD0AphXyCLbnZjR4bK0k2ah7Mjz8eHn%2FQTCa4H9%2FExu%2FTYCfEYA2NguTiGt1ta0CzeyQC%2B64d3qjrNp7Tp2%2BdmXSoOepVKkRsg9IjnkZ5xhkPNb2nIpDO7fjfpWWMG5Fl07NIY%2FQORshtIsXw4N0gQ%3D%3D&forceInstallVer2=true"
                },
                "code": "SUCCESS"
            });
        }


        // ==========================================
        // THIRD ROUTE: NEW TRANSACTION STATUS INQUIRY (POLLING)
        // Matches paths like: transaction/order/DMYPAGxxxxxx
        // ==========================================
        if (path.startsWith('transaction/order/')) {
            // Safely pluck the raw order ID from the end of our slug path arrays
            const extractedOrderId = urlParts[urlParts.length - 1];
            const cleanOrderId = extractedOrderId.split('&')[0]; // strip stray params if any

            return res.status(200).json({
                "item": {
                    "store": {
                        "id": "1767688690703368016",
                        "name": "paydee merchant 1",
                        "imageUrl": "https://storage.googleapis.com/rm-prod-asset/img/store.png",
                        "addressLine1": "", "addressLine2": "", "postCode": "", "city": "", "state": "", "country": "", "countryCode": "", "phoneNumber": "",
                        "geoLocation": { "latitude": 0, "longitude": 0 },
                        "status": "ACTIVE",
                        "createdAt": "2026-01-06T08:38:10Z",
                        "updatedAt": "2026-01-06T08:38:10Z"
                    },
                    "referenceId": "REF_" + cleanOrderId.replace('DMYPAG', ''),
                    "transactionId": "TXN_" + cleanOrderId.replace('DMYPAG', ''),
                    "order": {
                        "id": cleanOrderId, // Automatically dynamic to match whatever transaction they query
                        "title": "Payment to merchant",
                        "detail": "",
                        "amount": 100
                    },
                    "terminalId": "",
                    "payee": { "userId": "1000009067743988", "subUserId": "" },
                    "currencyType": "MYR",
                    "balanceAmount": 100,
                    "finalAmount": 100,
                    "voucher": null,
                    "platform": "OPEN_API",
                    "method": "TNG",
                    "transactionAt": new Date().toISOString(),
                    "type": "WEB_PAYMENT",
                    "status": "SUCCESS",
                    "region": "MALAYSIA",
                    "extraInfo": {
                        "card": { "cardType": null, "provider": "", "isTokenization": false, "token": "", "maskNo": "", "inputType": "", "referenceId": "", "domain": "", "secondaryReferenceId": "" },
                        "onlineBanking": null,
                        "manualRefund": null
                    },
                    "extendInfo": {
                        "inHousePromo": { "amount": 0, "info": null },
                        "buyNowPayLater": { "isBuyNowPayLater": false, "installmentMonth": 0 },
                        "cardInfo": { "fundingMethod": "", "scheme": "", "alpha2": "" },
                        "paymentSource": ""
                    },
                    "source": "",
                    "createdAt": new Date().toISOString(),
                    "updatedAt": new Date().toISOString()
                },
                "code": "SUCCESS"
            });
        }


        // Fallback catch
        return res.status(404).json({ "error": "Not Found", "path": path });

    } catch (err) {
        return res.status(500).json({ "error": "Server Error", "message": err.message });
    }
}
