exports.handler = async (event) => {
    const index = event.index;
    const step = typeof(event.step) !== 'undefined' && event.step !== null ? event.step:1;
    const next = index + Math.abs(step);
    if(typeof(event.count) !== 'undefined' && event.count !== null) {
        const {count} = event;
        return {
            index: next,
            step,
            count,
            continue: next < count
        };
    } else {
        return {
            index: next,
            step,
            continue: true
        };
    }
}
