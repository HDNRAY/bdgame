import EventBattleStart from './events/eventBattleStart'

export default class Queue {
    theQueue: Array<any>

    constructor() {
        this.theQueue = [new EventBattleStart()]
    }

    getEventsInTurn() {
        const frontEvent = this.theQueue.shift()
        const eventsInTurn = [frontEvent]
        while (this.theQueue.length > 0) {
            if (this.theQueue[0].leftTime === frontEvent.leftTime) {
                const parallelEvent = this.theQueue.shift()
                eventsInTurn.push(parallelEvent)
            } else {
                break
            }
        }
        const timeGoesBy = eventsInTurn[0].leftTime
        this.theQueue.forEach((event) => event.timeGoesBy(timeGoesBy))
        return eventsInTurn
    }

    insertInOrder(event: any) {
        //Can be optimized with binary search
        const queue = this.theQueue
        let i = 0
        for (; i < queue.length; i++) {
            // console.log('Insert: ' + event.executor.currentStatus.atk_period + ' : ' + queue[i].leftTime);
            if (event.leftTime <= queue[i].leftTime) {
                // console.log('Splice @' + i);
                queue.splice(i, 0, event)
                break
            }
        }
        if (i === queue.length) {
            // console.log('Splice @' + i);
            queue.splice(i, 0, event)
        }
    }
}
