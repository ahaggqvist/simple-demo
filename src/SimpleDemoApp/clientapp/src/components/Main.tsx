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
    const [namespacedPods, setNamespacedPods] = useState<IPod[]>([]);
    const [watchedPods, setWatchedPods] = useState<IPod[]>([]);
    const [nodePods, setNodePods] = useState<IPod[]>([]);
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

    const fetchNamespacedPods = useCallback(async () => {
        try {
            const nodePod = nodePods.sort((a, b) => a.resourceVersion > b.resourceVersion ? 1 : -1).at(-1);
            let resourceVersion = nodePod?.resourceVersion ?? "";
            return await axios.get<IPod[]>(`${process.env.REACT_APP_API_URL}pods?resourceVersion=${resourceVersion}`);
        } catch (error) {
            console.log(`Connection error  ${JSON.stringify(error)}`)
        }
    }, []);

    const updateNodePods = useCallback((watchedPod: IPod) => {
        const {id} = watchedPod;

        if (!nodePods?.some((p) => p.id === id)) {
            nodePods?.push(watchedPod);
        } else {
            const idx = nodePods.findIndex(p => p.id === id);
            if (idx !== -1) {
                nodePods[idx] = {...watchedPod};
            }
        }

        nodePods?.forEach((pod) => {
            const {id, eventType, state} = pod;

            if (eventType === "Added") {
                pod.color = "green";
            }

            if (eventType === "Modified" && state === "Pending") {
                pod.color = "orange";
            }

            if (eventType === "Modified" && state === "ContainerCreating") {
                pod.color = "blue";
            }

            if (eventType === "Modified" && state === "Running") {
                pod.color = "yellow";
                setTimeout(() => {
                    pod.color = "green";
                }, 5000)
            }

            if (eventType === "Deleted") {
                setNodePods(pods => pods?.filter(p => p.id !== id));
            }
        });
    }, [nodePods]);

    useEffect(() => {
        let interval = setInterval(() => {
            (async () => {
                const response = await fetchNamespacedPods();
                if (response?.status === 200) {
                    if (response.data.length > 0) {
                        setNamespacedPods(response.data);
                    }
                }
            })();
        }, 5000);
        return () => {
            clearInterval(interval);
        };
    }, [fetchNamespacedPods]);

    useEffect(() => {
        if (lastMessage !== null) {
            const watchedPod: IPod = JSON.parse(lastMessage.data);
            setWatchedPods(watchedPods => watchedPods?.concat(watchedPod));
            updateNodePods(watchedPod);
        }
    }, [lastMessage])

    return (
        <>
            <h1>Pods</h1>

            <table className="table">
                <thead style={{textAlign: "left"}}>
                <tr>
                    <th>Time</th>
                    <th>Name</th>
                    <th>Node</th>
                    <th>ResourceVersion</th>
                </tr>
                </thead>
                <tbody>
                {namespacedPods?.sort((a, b) => b.id.localeCompare(a.id)).map((namespacedPod, index) => {
                    return (
                        <tr key={index}>
                            <td>{namespacedPod.loggedAt}</td>
                            <td>{namespacedPod.name}</td>
                            <td>{namespacedPod.nodeName}</td>
                            <td>{namespacedPod.resourceVersion}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>

            <p>Environment: {process.env.REACT_APP_ENV}</p>

            <h1>Nodes</h1>
            {
                [...groupBy(nodePods, p => p.nodeName)].filter(([nodeName]) => (nodeName != null && nodeName !== "")).map(([nodeName, pods], index: number) => {
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

            <h1>History</h1>

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
                {watchedPods?.map((watchedPod, index) => {
                    return (
                        <tr key={index}>
                            <td>{watchedPod.loggedAt}</td>
                            <td>{watchedPod.name}</td>
                            <td>{watchedPod.nodeName}</td>
                            <td>{watchedPod.state}</td>
                            <td>{watchedPod.eventType}</td>
                            <td>{watchedPod.resourceVersion}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>
        </>
    );
}

export default Main;