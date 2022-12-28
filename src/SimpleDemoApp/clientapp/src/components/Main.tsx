import axios from "axios";
import React, {useCallback, useEffect, useRef, useState} from "react";
import useWebSocket, {ReadyState} from "react-use-websocket";

interface IPod {
    id: string,
    name: string,
    nodeName: string,
    state: string,
    eventType: string,
    color: string,
    loggedAt: string,
    resourceVersion: number
}

const Main = () => {
    const didUnmount = useRef(false);
    const [time, setTime] = useState("Fetching ...");
    const [podUpdates, setPodUpdates] = useState<IPod[]>([]);
    const [pods, setPods] = useState<IPod[]>([]);
    const {
        lastMessage,
        readyState
    } = useWebSocket(`ws://${window.location.host}${process.env.REACT_APP_API_WS_URL}`, {
        onError: (e) => console.log(`Connection error  ${JSON.stringify(e)}`),
        shouldReconnect: () => !didUnmount.current,
        retryOnError: true,
        reconnectAttempts: 15,
        reconnectInterval: 5000
    });
    const connectionStatus = {
        [ReadyState.CONNECTING]: "Connecting",
        [ReadyState.OPEN]: "Open",
        [ReadyState.CLOSING]: "Closing",
        [ReadyState.CLOSED]: "Closed",
        [ReadyState.UNINSTANTIATED]: "Uninstantiated",
    }[readyState];

    const groupBy = <K, V>(array: V[], grouper: (item: V) => K) => {
        return array.reduce((store, item) => {
            const key = grouper(item);
            if (!store.has(key)) {
                store.set(key, [item])
            } else {
                store.get(key)?.push(item)
            }
            return store
        }, new Map<K, V[]>())
    }

    const fetchTime = useCallback(async () => {
        try {
            return await axios.get<string>(`${process.env.REACT_APP_API_URL}time`);
        } catch (error) {
            console.log(`Connection error  ${JSON.stringify(error)}`)
        }
    }, []);

    const updatePodList = useCallback((podUpdate: IPod) => {
        const {id} = podUpdate;

        if (!pods?.some((p) => p.id === id)) {
            pods?.push(podUpdate);

            console.log(`Add pod to pods: ${JSON.stringify(podUpdate)}`);
        } else {
            const idx = pods.findIndex(p => p.id === id);
            if (idx !== -1) {
                pods[idx] = {...podUpdate};
            }
        }

        pods?.forEach((pod) => {
            const {id, eventType, state} = pod;

            if (eventType === "Added") {
                pod.color = "green";
            }

            if (eventType === "Modified" && state === "Pending") {
                pod.color = "yellow";
            }

            if (eventType === "Modified" && state === "ContainerCreating") {
                pod.color = "yellow";
            }

            if (eventType === "Modified" && state === "Running") {
                pod.color = "yellow";
                setTimeout(() => {
                    pod.color = "green";
                }, 5000)
            }

            if (eventType === "Deleted") {
                setPods(pods => pods?.filter(p => p.id !== id));
            }
        });
    }, [pods]);

    useEffect(() => {
        let interval = setInterval(() => {
            (async () => {
                const response = await fetchTime();
                if (response?.status === 200) {
                    if (response.data.length > 0) {
                        setTime(response.data);
                    }
                }
            })();
        }, 5000);
        return () => {
            clearInterval(interval);
        };
    }, [fetchTime]);

    useEffect(() => {
        console.log(`Connection ${connectionStatus}`);

        if (lastMessage !== null) {
            const podUpdate: IPod = JSON.parse(lastMessage.data);
            setPodUpdates(podUpdates => podUpdates?.concat(podUpdate));
            updatePodList(podUpdate);
        }
    }, [lastMessage])

    return (
        <>
            <h1>{time}</h1>
            <p>{process.env.REACT_APP_ENV}</p>

            {
                [...groupBy(pods, p => p.nodeName)].filter(([nodeName]) => (nodeName != null && nodeName !== "")).map(([nodeName, pods], index: number) => {
                    return (
                        <div key={index}>
                            <b>{nodeName}</b>
                            <div className="flex-container">
                                {
                                    pods.sort((a, b) => b.id.localeCompare(a.id)).map((pod, index) => {
                                        return (
                                            <div title={pod.name} key={index} style={{
                                                backgroundColor: pod.color
                                            }}></div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    )
                })
            }

            <table className="table">
                <thead style={{textAlign: "left"}}>
                <tr>
                    <th>Time</th>
                    <th>Name</th>
                    <th>Node</th>
                    <th>State</th>
                    <th>Event</th>
                    <th>ResourceVersion</th>
                </tr>
                </thead>
                <tbody>
                {podUpdates?.map((podUpdate, index) => {
                    return (
                        <tr key={index}>
                            <td>{podUpdate.loggedAt}</td>
                            <td>{podUpdate.name}</td>
                            <td>{podUpdate.nodeName}</td>
                            <td>{podUpdate.state}</td>
                            <td>{podUpdate.eventType}</td>
                            <td>{podUpdate.resourceVersion}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
        </>
    );
}

export default Main;