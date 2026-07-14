from athena.adapters.parity import assert_same_shape
from athena.adapters.google_reviews import GoogleReviewsAdapter


def test_reviews_fixture_matches_documented_shape():
    reference = {"reviews": [{"name": "n", "reviewId": "r",
                              "reviewer": {"profilePhotoUrl": "p", "displayName": "d", "isAnonymous": False},
                              "starRating": "FIVE", "comment": "c",
                              "createTime": "t", "updateTime": "t"}],
                 "averageRating": 0.0, "totalReviewCount": 0, "nextPageToken": "x"}
    fixture = GoogleReviewsAdapter(mode="fixture")._load("google_reviews.json")
    assert_same_shape(reference, fixture)
