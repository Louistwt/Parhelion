import httpx

from parhelion.providers.base import ImageJob
from parhelion.providers.fal import FalImageProvider


def test_fal_queue_flow_with_mock_transport():
    calls = []

    def handler(request: httpx.Request):
        calls.append((request.method, str(request.url)))
        assert request.headers["Authorization"] == "Key k"
        url = str(request.url)
        if request.method == "POST":
            return httpx.Response(200, json={"request_id": "r1", "status_url": "https://queue.fal.run/x/requests/r1/status",
                                             "response_url": "https://queue.fal.run/x/requests/r1"})
        if url.endswith("/status"):
            return httpx.Response(200, json={"status": "COMPLETED"})
        if url.endswith("/requests/r1"):
            return httpx.Response(200, json={"images": [{"url": "https://cdn/x.png", "content_type": "image/png"}], "seed": 7})
        return httpx.Response(200, content=b"PNGDATA", headers={"content-type": "image/png"})

    p = FalImageProvider("k", client=httpx.Client(transport=httpx.MockTransport(handler)), poll_interval_s=0)
    res = p.generate(ImageJob(prompt="hi", num_images=1, params={"aspect_ratio": "9:16"}), "x")
    assert res.request_id == "r1" and res.seed == 7 and res.images[0].data == b"PNGDATA"
    assert res.request_payload["aspect_ratio"] == "9:16"
