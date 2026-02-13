import json

# Read the feature list
with open('../feature_list.json', 'r') as f:
    features = json.load(f)

# Mark feature #27 as passing
for feature in features:
    if feature['id'] == 27:
        feature['passes'] = True
        print(f"Marked feature #{feature['id']} as passing: {feature['description']}")

# Write back
with open('../feature_list.json', 'w') as f:
    json.dump(features, f, indent=2)

print("Feature list updated successfully!")
