/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 */
define(['N/record'], function (record) {
    function helper() {
        return record.load({ type: 'customer', id: 1 });
    }

    return {
        beforeLoad: function (context) {
            helper();
        }
    };
});
