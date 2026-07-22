class DigiFlazzClient {
    constructor(username, apiKey, refId) {
        this.base = 'https://api.digiflazz.com/v1';
        this.refId = refId || `AFPEB-${Math.floor(Math.random() * 1000000)}XYZ`;
        this.user = username;
        this.key = apiKey;
    }

    async connect(endPoint, headers, postData) {
        const response = await fetch(endPoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(postData)
        });
        return response.json();
    }

    async checkBalance() {
        const postData = {
            cmd: 'deposit',
            username: this.user,
            sign: md5(this.user + this.key + 'depo')
        };

        const data = (await this.connect(`${this.base}/cek-saldo`, {'Content-Type': 'application/json'}, postData)).data;

        if (data.message) {
            return { result: false, data: null, message: data.message };
        } else if (!data) {
            return { result: false, data: null, message: 'Failed to get balance information.' };
        } else {
            return { result: true, data: { balance: data.deposit }, message: 'Balance information successfully obtained.' };
        }
    }

    async priceList() {
        const prepaidData = {
            cmd: 'prepaid',
            username: this.user,
            sign: md5(this.user + this.key + this.refId)
        };

        const postpaidData = {
            cmd: 'pasca',
            username: this.user,
            sign: md5(this.user + this.key + this.refId)
        };

        const data = {
            prepaid: (await this.connect(`${this.base}/price-list`, {'Content-Type': 'application/json'}, prepaidData)).data,
            postpaid: (await this.connect(`${this.base}/price-list`, {'Content-Type': 'application/json'}, postpaidData)).data
        };

        if (data.prepaid.message) {
            return { result: false, data: null, message: data.prepaid.message };
        } else if (!data.prepaid) {
            return { result: false, data: null, message: 'Failed to get service data.' };
        } else {
            const out = [];
            data.prepaid.forEach(item => {
                const status = item.buyer_product_status ? 'available' : 'empty';
                out.push({
                    name: ucwords(item.product_name),
                    note: item.desc,
                    code: item.buyer_sku_code,
                    tipe: item.type,
                    type: 'Prepaid',
                    brand: item.brand.toUpperCase(),
                    price: item.price,
                    multi: item.multi,
                    status: item.seller_product_status ? status : 'empty',
                    category: item.category.toUpperCase(),
                });
            });

            data.postpaid.forEach(item => {
                const status = item.buyer_product_status ? 'available' : 'empty';
                const price = item.admin < 1 ? '0' : item.admin - item.commission;
                out.push({
                    name: ucwords(item.product_name),
                    note: '',
                    code: item.buyer_sku_code,
                    tipe: 'Umum',
                    type: 'Postpaid',
                    brand: item.brand.toUpperCase(),
                    price: price,
                    multi: false,
                    status: item.seller_product_status ? status : 'empty',
                    category: item.category.toUpperCase(),
                });
            });

            return { result: true, data: out, message: 'Service Data successfully obtained.' };
        }
    }

    async topup(id, target, reff) {
        const postData = {
            username: this.user,
            buyer_sku_code: id,
            customer_no: target,
            ref_id: reff,
            sign: md5(this.user + this.key + reff),
            msg: ''
        };

        const data = (await this.connect(`${this.base}/transaction`, {'Content-Type': 'application/json'}, postData)).data;

        if (data.status === 'Gagal') {
            return { result: false, data: null, message: data.message };
        } else {
            return {
                result: true,
                data: {
                    trxid: data.ref_id,
                    price: data.price,
                    status: data.status === 'Sukses' ? 'success' : 'processing',
                    balance: data.buyer_last_saldo
                },
                message: data.sn !== '' ? data.sn : data.message
            };
        }
    }

    async checkTopup(id, target, refId) {
        const postData = {
            username: this.user,
            buyer_sku_code: id,
            customer_no: target,
            ref_id: refId,
            sign: md5(this.user + this.key + refId),
            msg: ''
        };

        const data = (await this.connect(`${this.base}/transaction`, {'Content-Type': 'application/json'}, postData)).data;

        if (data.ref_id) {
            let status = 'processing';
            if (data.status === 'Sukses') status = 'success';
            if (data.status === 'Gagal') status = 'error';
            return {
                result: true,
                data: {
                    trxid: data.ref_id,
                    price: data.price,
                    status: status,
                    balance: data.buyer_last_saldo
                },
                message: data.sn !== '' ? data.sn : data.message
            };
        } else {
            return { result: false, data: null, message: data.message };
        }
    }

    async checkBill(id, target, reff) {
        const postData = {
            commands: 'inq-pasca',
            username: this.user,
            buyer_sku_code: id,
            customer_no: target,
            ref_id: reff,
            sign: md5(this.user + this.key + reff),
            msg: ''
        };

        const data = (await this.connect(`${this.base}/transaction`, {'Content-Type': 'application/json'}, postData)).data;

        if (data.status === 'Gagal') {
            return { result: false, data: null, message: data.message };
        } else {
            return {
                result: true,
                data: {
                    trxid: data.ref_id,
                    price: data.price,
                    selling_price: data.selling_price,
                    customer_name: data.customer_name,
                    customer_no: data.customer_no,
                    admin: data.admin,
                    status: data.status === 'Sukses' ? 'success' : 'processing',
                    balance: data.buyer_last_saldo
                },
                message: data.sn !== '' ? data.sn : data.message
            };
        }
    }

    async payBill(id, target, reff) {
        const postData = {
            commands: 'pay-pasca',
            username: this.user,
            buyer_sku_code: id,
            customer_no: target,
            ref_id: reff,
            sign: md5(this.user + this.key + reff),
            msg: ''
        };

        const data = (await this.connect(`${this.base}/transaction`, {'Content-Type': 'application/json'}, postData)).data;

        if (data.status === 'Gagal') {
            return { result: false, data: null, message: data.message };
        } else {
            return {
                result: true,
                data: {
                    trxid: data.ref_id,
                    price: data.price,
                    selling_price: data.selling_price,
                    customer_name: data.customer_name,
                    customer_no: data.customer_no,
                    admin: data.admin,
                    status: data.status === 'Sukses' ? 'success' : 'processing',
                    balance: data.buyer_last_saldo
                },
                message: data.sn !== '' ? data.sn : data.message
            };
        }
    }
    
    async inquiryPln(id) {
      const postData = {
        commands: "pln-subscribe",
        customer_no: id
      }
      
      const data = (await this.connect(`${this.base}/transaction`, {'Content-Type': 'application/json'}, postData)).data;
      
      if (data.status == 'Gagal') {
        return { result: false, data: data, message: data.message };
      } else {
        return {
          result: true,
          data: {
            customer_no: data.customer_no,
            meter_no: data.meter_no,
            subscriber_id: data.subscriber_id,
            name: data.name,
            segment_power: data.segment_power
          },
          message: ''
        }
      }
    }
}

// Helper functions
function md5(string) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(string).digest('hex');
}

function ucwords(str) {
    return str.replace(/\b[a-z]/g, char => char.toUpperCase());
}

module.exports = DigiFlazzClient;