class MedanPedia {
    constructor(api_id, api_key) {
        this.api_id = api_id;
        this.api_key = api_key;
        this.baseURL = 'https://api.medanpedia.co.id';
    }

    async request(endpoint, body) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return response.json(); // This already parses the JSON response to an object
    }

    cekSaldo() {
        return this.request('/profile', {
            api_id: this.api_id,
            api_key: this.api_key
        });
    }

    daftarLayanan(service_fav = false) {
        return this.request('/services', {
            api_id: this.api_id,
            api_key: this.api_key,
            service_fav: service_fav ? 1 : 0
        });
    }

    // Default Order
    pesanDefault(service, target, quantity) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            quantity: quantity
        });
    }

    // Package Order
    pesanPackage(service, target, quantity) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            quantity: quantity
        });
    }

    // Custom Comment Order
    pesanCustomComment(service, target, comment) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            comment: comment
        });
    }

    // Mentions Custom List Order
    pesanMentionsCustomList(service, target, customList) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            custom_list: customList
        });
    }

    // Mentions Hashtag Order
    pesanMentionsHashtag(service, target, hashtag) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            hashtag: hashtag
        });
    }

    // Mentions User Followers Order
    pesanMentionsUserFollowers(service, target, userFollowers) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            user_followers: userFollowers
        });
    }

    // Mentions Media Likers Order
    pesanMentionsMediaLikers(service, target, mediaLikers) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            media_likers: mediaLikers
        });
    }

    // Poll Order
    pesanPoll(service, target, pollOption) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            poll_option: pollOption
        });
    }

    // Comments Replies Order
    pesanCommentsReplies(service, target, reply) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            reply: reply
        });
    }

    // Comments Likes Order
    pesanCommentsLikes(service, target, commentId) {
        return this.request('/order', {
            api_id: this.api_id,
            api_key: this.api_key,
            service: service,
            target: target,
            comment_id: commentId
        });
    }

    cekStatusPesanan(order_id) {
        return this.request('/status', {
            api_id: this.api_id,
            api_key: this.api_key,
            id: order_id
        });
    }

    refill(order_id) {
        return this.request('/refill', {
            api_id: this.api_id,
            api_key: this.api_key,
            order_id: order_id
        });
    }

    cekStatusRefill(order_id) {
        return this.request('/refill_status', {
            api_id: this.api_id,
            api_key: this.api_key,
            order_id: order_id
        });
    }

    async getCategories() {
        const services = await this.daftarLayanan();
        const categories = new Set();
        services.data.forEach(service => {
            categories.add(service.category);
        });
        return Array.from(categories).sort((a, b) => a.localeCompare(b));
    }
}

module.exports = MedanPedia;

/* Usage example
const medanPedia = new MedanPedia(14243, 'your_api_key_here');

// Example calls
medanPedia.cekSaldo().then(data => console.log(data));
medanPedia.daftarLayanan().then(data => console.log(data));

// Order examples
medanPedia.pesanDefault(11, 'sebastianwirajaya11').then(data => console.log(data));
medanPedia.pesanPackage(12, 'sebastianwirajaya12', 100).then(data => console.log(data));
medanPedia.pesanCustomComment(13, 'sebastianwirajaya13', 'This is a custom comment').then(data => console.log(data));
medanPedia.pesanMentionsCustomList(14, 'sebastianwirajaya14', 'list1,list2,list3').then(data => console.log(data));
medanPedia.pesanMentionsHashtag(15, 'sebastianwirajaya15', '#example').then(data => console.log(data));
medanPedia.pesanMentionsUserFollowers(16, 'sebastianwirajaya16', 'followers_list').then(data => console.log(data));
medanPedia.pesanMentionsMediaLikers(17, 'sebastianwirajaya17', 'likers_list').then(data => console.log(data));
medanPedia.pesanPoll(18, 'sebastianwirajaya18', 'option1').then(data => console.log(data));
medanPedia.pesanCommentsReplies(19, 'sebastianwirajaya19', 'This is a reply').then(data => console.log(data));
medanPedia.pesanCommentsLikes(20, 'sebastianwirajaya20', 'comment_id').then(data => console.log(data));

medanPedia.cekStatusPesanan('order_id_here').then(data => console.log(data));
medanPedia.refill('order_id_here').then(data => console.log(data));
medanPedia.cekStatusRefill('order_id_here').then(data => console.log(data));
medanPedia.getCategories().then(categories => console.log(categories));
*/