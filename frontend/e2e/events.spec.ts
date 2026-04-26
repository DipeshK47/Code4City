import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:5001";

test.describe("UrbanReach outreach events", () => {
  test("volunteer can join an event, view the optimized route, and complete a stop", async ({
    page,
    request,
  }) => {
    const runId = Date.now();
    const eventTitle = `E2E Route Optimization Outreach ${runId}`;

    const createResponse = await request.post(`${API_BASE}/api/events`, {
      data: {
        title: eventTitle,
        description:
          "End-to-end test event for validating recommendations, route optimization, and stop completion.",
        category: "food",
        zoneId: 1,
        locationLabel: "Sunset Park Test Zone",
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
        volunteerCapacity: 5,
        priorityScore: 89,
        estimatedReach: 125,
        stops: [
          {
            name: `E2E Transit Stop ${runId}`,
            address: "59 St Station, Brooklyn, NY",
            lat: 40.6417,
            lng: -74.0177,
            stopType: "transit",
            priorityWeight: 95,
          },
          {
            name: `E2E Library Stop ${runId}`,
            address: "5108 4th Ave, Brooklyn, NY",
            lat: 40.6456,
            lng: -74.0118,
            stopType: "library",
            priorityWeight: 80,
          },
        ],
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();
    const eventId = created.data.id;

    await page.addInitScript(() => {
      window.localStorage.setItem("lemontree_guest", "1");
    });

    await page.goto(`/events/${eventId}`);

    await expect(page.getByRole("heading", { name: eventTitle })).toBeVisible();
    await expect(page.getByText("Optimized Stop Order")).toBeVisible();
    await expect(page.getByText("Route Summary")).toBeVisible();
    await expect(page.getByText(`E2E Transit Stop ${runId}`)).toBeVisible();
    await expect(page.getByText(`E2E Library Stop ${runId}`)).toBeVisible();

    await page.getByRole("button", { name: "Join Event" }).click();
    await expect(page.getByText("1/5")).toBeVisible();

    await page.getByRole("button", { name: "Complete" }).first().click();
    await expect(page.getByText("50%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete" })).toHaveCount(1);
  });

  test("events page shows recommended events and organizer zone recommendations", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("lemontree_guest", "1");
    });

    await page.goto("/events");

    await expect(
      page.getByRole("heading", {
        name: "Coordinate outreach events where they matter most.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Recommended Events")).toBeVisible();
    await expect(page.getByText("Zone Recommendations")).toBeVisible();
    await expect(page.getByText("Best next event")).toBeVisible();
  });
});
