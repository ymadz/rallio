import { getPayment } from './web/src/lib/paymongo/client';

async function main() {
    try {
        const payment = await getPayment('pay_bwU4mMQNvQkNkDHEtbcAGDgU');
        console.log(JSON.stringify(payment, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
