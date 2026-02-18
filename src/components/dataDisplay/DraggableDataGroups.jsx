/**
 * DraggableDataGroups - Wraps DataGroup components in a drag-and-drop list
 * (react-beautiful-dnd) so agents can reorder data sections. The custom order
 * is persisted in chrome.storage.local and restored on mount. Dragging is
 * disabled when `isLocked` is true.
 */

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import DataGroup from "./DataGroup";
import { achievementTriggers } from "../../utils/achievementTriggers";
import carrierDetector from "../../services/tracking/carrierDetector";

// Fallback display order when no saved preference exists
const DEFAULT_ORDER = [
  "customerName",
  "tickets",
  "orderNumbers",
  "storeNumbers",
  "giftCards",
  "purNumbers",
  "phones",
  "skus",
  "emails",
  "trackingNumbers",
  "totalAmounts",
];

const DraggableDataGroups = ({ ticketData, isLocked }) => {
  // DEBUG: Verbose logging on every render -- consider removing or gating
  // behind a debug flag before production to avoid console noise.
  console.log("[DraggableDataGroups] Component rendered with props:", {
    ticketData,
    isLocked,
  });

  if (ticketData?.trackingNumbers) {
    console.log("[DraggableDataGroups] Tracking numbers analysis:", {
      count: ticketData.trackingNumbers.length,
      numbers: ticketData.trackingNumbers,
      validation: ticketData.trackingNumbers.map((num) => ({
        number: num,
        length: num.length,
        carrier: carrierDetector.detectCarrier(num),
        isValid: carrierDetector.isValidTrackingNumber(num),
      })),
    });
  } else {
    console.log(
      "[DraggableDataGroups] No tracking numbers found in ticket data"
    );
  }

  const [groupOrder, setGroupOrder] = useState(DEFAULT_ORDER);

  // Restore persisted group order; append any new groups that were added since last save
  useEffect(() => {
    const loadSavedOrder = async () => {
      try {
        const result = await chrome.storage.local.get("dataGroupOrder");
        if (result.dataGroupOrder && Array.isArray(result.dataGroupOrder)) {
          const savedOrder = result.dataGroupOrder;
          // If new group types were added to DEFAULT_ORDER, tack them on at the end
          const missingGroups = DEFAULT_ORDER.filter(
            (group) => !savedOrder.includes(group)
          );

          if (missingGroups.length > 0) {
            // Add any missing groups to the end
            const updatedOrder = [...savedOrder, ...missingGroups];
            setGroupOrder(updatedOrder);
            await chrome.storage.local.set({ dataGroupOrder: updatedOrder });
          } else {
            setGroupOrder(savedOrder);
          }
        }
      } catch (error) {
        console.error("Failed to load group order:", error);
      }
    };

    loadSavedOrder();
  }, []);

  // Reorder groups on drop: optimistic update with rollback on storage failure
  const handleDragEnd = async (result) => {
    if (!result.destination || isLocked) return;

    const oldOrder = [...groupOrder]; // snapshot for rollback
    const newOrder = Array.from(groupOrder);
    const [reorderedItem] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, reorderedItem);

    setGroupOrder(newOrder); // optimistic UI update

    try {
      await chrome.storage.local.set({ dataGroupOrder: newOrder });
      await achievementTriggers.onDragUsed();
    } catch (error) {
      console.error("Failed to save group order:", error);
      setGroupOrder(oldOrder); // rollback on failure
    }
  };

  // Map internal group keys to user-facing display names
  const getGroupTitle = (key) => {
    const titles = {
      customerName: "Customer Name",
      tickets: "Ticket Numbers",
      orderNumbers: "Order Numbers",
      storeNumbers: "Store Numbers",
      giftCards: "Gift Cards",
      purNumbers: "PowerUp Rewards",
      phones: "Phone Numbers",
      skus: "SKUs",
      emails: "Email Addresses",
      trackingNumbers: "Tracking Numbers",
      totalAmounts: "Total Amounts",
    };
    return titles[key] || key;
  };

  // Map internal group keys to DataGroup's `type` prop for icon/action selection
  const getGroupType = (key) => {
    const types = {
      customerName: "customer",
      tickets: "ticket",
      orderNumbers: "order",
      storeNumbers: "store",
      giftCards: "giftCard",
      purNumbers: "pur",
      phones: "phone",
      skus: "sku",
      emails: "email",
      trackingNumbers: "tracking",
      totalAmounts: "amount",
    };
    return types[key] || key;
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="data-groups">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {groupOrder.map((groupKey, index) => {
                // Special handling for customerName
                if (groupKey === "customerName" && ticketData?.customerName) {
                  return (
                    <Draggable
                      key={groupKey}
                      draggableId={groupKey}
                      index={index}
                      isDragDisabled={isLocked}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`transition-shadow ${
                            snapshot.isDragging ? "shadow-lg" : ""
                          } ${
                            isLocked
                              ? "cursor-default"
                              : "cursor-grab active:cursor-grabbing"
                          }`}
                        >
                          <DataGroup
                            title={getGroupTitle(groupKey)}
                            items={[ticketData.customerName]}
                            type={getGroupType(groupKey)}
                          />
                        </div>
                      )}
                    </Draggable>
                  );
                }

                // Skip groups with no data
                if (!ticketData?.[groupKey]?.length) {
                  return null;
                }

                // Special handling for tracking numbers
                if (groupKey === "trackingNumbers") {
                  console.log(
                    "[DraggableDataGroups] Rendering tracking numbers group:",
                    {
                      groupKey,
                      index,
                      exists: !!ticketData?.trackingNumbers,
                      length: ticketData?.trackingNumbers?.length,
                      data: ticketData?.trackingNumbers,
                      carrierAnalysis: ticketData?.trackingNumbers?.map(
                        (num) => ({
                          number: num,
                          length: num.length,
                          carrier: carrierDetector.detectCarrier(num),
                          isValid: carrierDetector.isValidTrackingNumber(num),
                          trackingUrl: carrierDetector.getTrackingUrl(num),
                        })
                      ),
                    }
                  );
                }

                return (
                  <Draggable
                    key={groupKey}
                    draggableId={groupKey}
                    index={index}
                    isDragDisabled={isLocked}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`transition-shadow ${
                          snapshot.isDragging ? "shadow-lg" : ""
                        } ${
                          isLocked
                            ? "cursor-default"
                            : "cursor-grab active:cursor-grabbing"
                        }`}
                      >
                        <DataGroup
                          title={getGroupTitle(groupKey)}
                          items={ticketData[groupKey]}
                          type={getGroupType(groupKey)}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default DraggableDataGroups;
