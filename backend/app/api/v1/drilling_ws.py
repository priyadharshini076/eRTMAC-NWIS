import asyncio
import json
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

@router.websocket("/ws/drilling")
async def websocket_drilling_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # State tracking
    is_drilling = False
    current_depth = 3842.0
    metres_drilled = 0.0
    depth_increment = 0.25 # user can adjust later
    
    try:
        while True:
            # Check for incoming commands with a timeout
            try:
                message_text = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                data = json.loads(message_text)
                action = data.get("action")
                if action == "start":
                    is_drilling = True
                elif action == "stop" or action == "pause":
                    is_drilling = False
                elif action == "set_increment":
                    depth_increment = float(data.get("increment", 0.25))
                elif action == "set_depth":
                    current_depth = float(data.get("depth", current_depth))
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

            if is_drilling:
                # Every 5 seconds, drilling increases
                current_depth += depth_increment
                metres_drilled += depth_increment
                
                # Jitter drilling parameters realistically
                rop = round(14.8 + random.uniform(-1.2, 1.5), 1)
                wob = round(18.2 + random.uniform(-0.8, 1.1), 1)
                rpm = int(110 + random.randint(-4, 4))
                torque = round(21.4 + random.uniform(-0.9, 1.3), 1)
                spp = int(3260 + random.randint(-40, 50))
                flow = int(2340 + random.randint(-30, 40))

                packet = {
                    "type": "telemetry_pulse",
                    "status": "DRILLING",
                    "current_depth_m": round(current_depth, 2),
                    "metres_drilled_m": round(metres_drilled, 2),
                    "distance_to_td_m": round(max(0, 4100.0 - current_depth), 2),
                    "rop_m_hr": rop,
                    "wob_klbs": wob,
                    "rpm": rpm,
                    "torque_kft_lb": torque,
                    "spp_psi": spp,
                    "flow_rate_lpm": flow,
                    "mud_weight_sg": 1.32,
                    "formation": "Barail Sandstone",
                    "interval_seconds": 5
                }
                await websocket.send_text(json.dumps(packet))
                await asyncio.sleep(5)
            else:
                # Idle heartbeat
                packet = {
                    "type": "heartbeat",
                    "status": "STANDBY",
                    "current_depth_m": round(current_depth, 2),
                    "metres_drilled_m": round(metres_drilled, 2),
                    "interval_seconds": 5
                }
                await websocket.send_text(json.dumps(packet))
                await asyncio.sleep(1)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
